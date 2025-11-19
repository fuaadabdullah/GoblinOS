import { KubeConfig, AppsV1Api } from '@kubernetes/client-node';
import { ComplexityTracker } from './metrics.js';

export interface ScalingPolicy {
  complexityThresholds: {
    low: number;
    medium: number;
    high: number;
  };
  modelResourceWeights: Record<string, number>;
  scaleUpFactors: {
    low: number;
    medium: number;
    high: number;
  };
}

export class OllamaScalingController {
  private kubeConfig: KubeConfig;
  private appsApi: AppsV1Api;
  private complexityTracker: ComplexityTracker;
  private policy: ScalingPolicy;
  private namespace: string;
  private deploymentName: string;

  constructor(
    namespace: string = 'goblinos-ai',
    deploymentName: string = 'ollama-inference',
    policy: ScalingPolicy
  ) {
    this.namespace = namespace;
    this.deploymentName = deploymentName;
    this.policy = policy;
    this.complexityTracker = new ComplexityTracker();

    // Initialize Kubernetes client
    this.kubeConfig = new KubeConfig();
    this.kubeConfig.loadFromDefault();
    this.appsApi = this.kubeConfig.makeApiClient(AppsV1Api);
  }

  async startScalingLoop(intervalMs: number = 30000) {
    console.log('Starting Ollama scaling controller...');

    setInterval(async () => {
      try {
        await this.evaluateAndScale();
      } catch (error) {
        console.error('Scaling evaluation failed:', error);
      }
    }, intervalMs);
  }

  private async evaluateAndScale() {
    const complexity = this.complexityTracker.getAverageComplexity();
    const trend = this.complexityTracker.getComplexityTrend();

    console.log(`Current complexity: ${complexity}, trend: ${trend}`);

    // Determine scaling action based on complexity and trend
    const scalingAction = this.determineScalingAction(complexity, trend);

    if (scalingAction.action !== 'none') {
      await this.applyScaling(scalingAction);
    }
  }

  private determineScalingAction(complexity: number, trend: string): {
    action: 'scale_up' | 'scale_down' | 'none';
    factor: number;
    reason: string;
  } {
    const { complexityThresholds, scaleUpFactors } = this.policy;

    if (complexity >= complexityThresholds.high) {
      return {
        action: 'scale_up',
        factor: scaleUpFactors.high,
        reason: `High complexity (${complexity}) detected`
      };
    }

    if (complexity >= complexityThresholds.medium) {
      return {
        action: 'scale_up',
        factor: scaleUpFactors.medium,
        reason: `Medium complexity (${complexity}) detected`
      };
    }

    if (complexity <= complexityThresholds.low && trend === 'decreasing') {
      return {
        action: 'scale_down',
        factor: 0.8, // Scale down by 20%
        reason: `Low complexity (${complexity}) with decreasing trend`
      };
    }

    return {
      action: 'none',
      factor: 1.0,
      reason: `Complexity (${complexity}) within normal range`
    };
  }

  private async applyScaling(action: {
    action: 'scale_up' | 'scale_down' | 'none';
    factor: number;
    reason: string;
  }) {
    if (action.action === 'none') return;

    try {
      // Get current deployment
      const deployment = await this.appsApi.readNamespacedDeployment(
        this.deploymentName,
        this.namespace
      );

      const currentReplicas = deployment.body.spec?.replicas || 1;
      const currentResources = deployment.body.spec?.template.spec?.containers[0].resources;

      let newReplicas = currentReplicas;
      let newResources = currentResources;

      if (action.action === 'scale_up') {
        newReplicas = Math.min(Math.ceil(currentReplicas * action.factor), 10); // Max 10 replicas
        newResources = this.scaleResources(currentResources, action.factor);
      } else if (action.action === 'scale_down') {
        newReplicas = Math.max(Math.floor(currentReplicas * action.factor), 1); // Min 1 replica
        newResources = this.scaleResources(currentResources, action.factor);
      }

      // Update deployment
      if (deployment.body.spec) {
        deployment.body.spec.replicas = newReplicas;
        if (deployment.body.spec.template.spec?.containers[0]) {
          deployment.body.spec.template.spec.containers[0].resources = newResources;
        }

        await this.appsApi.replaceNamespacedDeployment(
          this.deploymentName,
          this.namespace,
          deployment.body
        );

        console.log(`Applied scaling: ${action.action} to ${newReplicas} replicas (${action.reason})`);
      }
    } catch (error) {
      console.error('Failed to apply scaling:', error);
    }
  }

  private scaleResources(currentResources: any, factor: number): any {
    if (!currentResources) return currentResources;

    const scaleValue = (value: string) => {
      const numValue = parseInt(value);
      return `${Math.ceil(numValue * factor)}${value.replace(/[0-9]/g, '')}`;
    };

    return {
      ...currentResources,
      limits: {
        ...currentResources.limits,
        cpu: currentResources.limits?.cpu ? scaleValue(currentResources.limits.cpu) : undefined,
        memory: currentResources.limits?.memory ? scaleValue(currentResources.limits.memory) : undefined,
      },
      requests: {
        ...currentResources.requests,
        cpu: currentResources.requests?.cpu ? scaleValue(currentResources.requests.cpu) : undefined,
        memory: currentResources.requests?.memory ? scaleValue(currentResources.requests.memory) : undefined,
      }
    };
  }

  // Method to update complexity from external metrics
  updateComplexity(score: number) {
    this.complexityTracker.addComplexityScore(score);
  }
}

// Factory function to create and start the controller
export async function createScalingController(
  policy: ScalingPolicy,
  namespace?: string,
  deploymentName?: string
): Promise<OllamaScalingController> {
  const controller = new OllamaScalingController(namespace, deploymentName, policy);

  // Load policy from ConfigMap if available
  try {
    // In a real implementation, this would load from Kubernetes ConfigMap
    console.log('Scaling controller created with policy:', policy);
  } catch (error) {
    console.warn('Could not load scaling policy from ConfigMap:', error);
  }

  return controller;
}
