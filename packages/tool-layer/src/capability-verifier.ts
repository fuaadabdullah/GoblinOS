import jwt from 'jsonwebtoken';

export class CapabilityVerifier {
  private secret: string;

  constructor() {
    // Prefer an explicit environment variable for secrets. In development, allow a dev fallback
    this.secret = process.env.TOOL_LAYER_JWT_SECRET || process.env.TOOL_LAYER_SECRET || '';
    if (!this.secret && process.env.NODE_ENV !== 'development') {
      throw new Error('TOOL_LAYER_JWT_SECRET must be set in production');
    }
  }

  verify(token: string): boolean {
    try {
      jwt.verify(token, this.secret);
      return true;
    } catch {
      return false;
    }
  }

  decodeToken(token: string): any | null {
    try {
      const decoded = jwt.verify(token, this.secret);
      return decoded;
    } catch {
      return null;
    }
  }

  generateToken(payload: any): string {
    return jwt.sign(payload, this.secret, { expiresIn: '1h' });
  }
}
