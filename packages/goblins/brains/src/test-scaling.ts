#!/usr/bin/env node

/**
 * Test script for Ollama LiteBrain dynamic scaling
 * Simulates different complexity workloads and validates scaling behavior
 */

import { createLiteBrain } from './index.js';
import { ComplexityTracker } from './metrics.js';

async function runScalingTest() {
  console.log('🧠 Starting Ollama LiteBrain Scaling Test\n');

  // Create a test LiteBrain instance
  const liteBrain = createLiteBrain('dregg-embercode');
  const complexityTracker = new ComplexityTracker();

  // Test scenarios with different complexity levels
  const testScenarios = [
    {
      name: 'Low Complexity - Simple task',
      task: 'Format this code snippet',
      complexity: 'low' as const,
      expectedModel: 'qwen2.5:3b'
    },
    {
      name: 'Medium Complexity - Code review',
      task: 'Review this TypeScript function for best practices and suggest improvements',
      complexity: 'medium' as const,
      expectedModel: 'deepseek-r1'
    },
    {
      name: 'High Complexity - Architecture design',
      task: 'Design a microservices architecture for a high-traffic e-commerce platform with 1M daily users, including service decomposition, API gateway, database sharding, caching strategies, and deployment pipeline',
      complexity: 'high' as const,
      expectedModel: 'deepseek-r1'
    }
  ];

  console.log('📊 Testing complexity estimation and model routing:\n');

  for (const scenario of testScenarios) {
    console.log(`\n--- ${scenario.name} ---`);

    try {
      const startTime = Date.now();

      const response = await liteBrain.process({
        task: scenario.task,
        context: {
          framework: 'TypeScript',
          environment: 'Node.js'
        }
      });

      const processingTime = Date.now() - startTime;

      // Update complexity tracker
      const complexityScore = scenario.complexity === 'low' ? 25 :
                             scenario.complexity === 'medium' ? 50 : 85;
      complexityTracker.addComplexityScore(complexityScore);

      console.log(`✅ Task completed successfully`);
      console.log(`📈 Estimated complexity: ${response.plan.estimatedComplexity}`);
      console.log(`🤖 Model used: ${response.metadata.model}`);
      console.log(`⏱️  Processing time: ${processingTime}ms`);
      console.log(`🎯 Steps generated: ${response.plan.steps.length}`);

      // Validate complexity estimation
      if (response.plan.estimatedComplexity !== scenario.complexity) {
        console.log(`⚠️  Complexity mismatch! Expected: ${scenario.complexity}, Got: ${response.plan.estimatedComplexity}`);
      }

    } catch (error) {
      console.log(`❌ Task failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Test scaling metrics
  console.log('\n📊 Scaling Metrics Summary:');
  console.log(`📈 Average complexity: ${complexityTracker.getAverageComplexity().toFixed(2)}`);
  console.log(`📉 Complexity trend: ${complexityTracker.getComplexityTrend()}`);

  // Simulate scaling decision
  const avgComplexity = complexityTracker.getAverageComplexity();
  let scalingDecision = 'No scaling needed';

  if (avgComplexity > 70) {
    scalingDecision = '🚀 Scale UP: High complexity detected - increase replicas and resources';
  } else if (avgComplexity > 40) {
    scalingDecision = '⚖️ Monitor: Medium complexity - maintain current resources';
  } else {
    scalingDecision = '⬇️ Scale DOWN: Low complexity - reduce resources if trend continues';
  }

  console.log(`🔧 Scaling Decision: ${scalingDecision}`);

  console.log('\n✅ Scaling test completed!');
}

// Run the test
runScalingTest().catch(console.error);
