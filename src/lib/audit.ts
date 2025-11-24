import { EnvEncryption } from './encryption';
import sql from '@/app/api/utils/sql';

// Enhanced audit logging for key access
export class KeyAuditLogger {
  private static instance: KeyAuditLogger;

  static getInstance(): KeyAuditLogger {
    if (!KeyAuditLogger.instance) {
      KeyAuditLogger.instance = new KeyAuditLogger();
    }
    return KeyAuditLogger.instance;
  }

  // Log key access attempts
  async logKeyAccess(data: {
    keyType: string;
    operation: string;
    userId: string;
    success: boolean;
    ipAddress?: string;
    userAgent?: string;
    errorMessage?: string;
    responseTime?: number;
  }) {
    try {
      const auditData = {
        event_type: 'KEY_ACCESS',
        user_id: data.userId,
        key_type: data.keyType,
        operation: data.operation,
        success: data.success,
        ip_address: data.ipAddress || 'unknown',
        user_agent: data.userAgent || 'unknown',
        error_message: data.errorMessage || null,
        response_time_ms: data.responseTime || null,
        timestamp: new Date().toISOString(),
        // Hash sensitive data for privacy
        key_hash: EnvEncryption.hash(data.keyType + data.operation),
      };

      // Store in audit log
      await sql`
        INSERT INTO audit_log (
          user_id, event_type, metadata, ip_address, user_agent, created_at
        ) VALUES (
          ${auditData.user_id},
          ${auditData.event_type},
          ${JSON.stringify(auditData)},
          ${auditData.ip_address},
          ${auditData.user_agent},
          ${auditData.timestamp}
        )
      `;

      // Log to console for monitoring
      console.log(`[KEY_AUDIT] ${auditData.timestamp} - ${data.keyType} - ${data.operation} - ${data.success ? 'SUCCESS' : 'FAILED'}`);

    } catch (error) {
      console.error('Failed to log key access:', error);
    }
  }

  // Log suspicious key usage
  async logSuspiciousActivity(data: {
    keyType: string;
    operation: string;
    userId: string;
    reason: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    details: any;
  }) {
    try {
      const auditData = {
        event_type: 'SUSPICIOUS_KEY_USAGE',
        user_id: data.userId,
        key_type: data.keyType,
        operation: data.operation,
        reason: data.reason,
        severity: data.severity,
        details: data.details,
        timestamp: new Date().toISOString(),
      };

      // Store in audit log
      await sql`
        INSERT INTO audit_log (
          user_id, event_type, metadata, created_at
        ) VALUES (
          ${auditData.user_id},
          ${auditData.event_type},
          ${JSON.stringify(auditData)},
          ${auditData.timestamp}
        )
      `;

      // Log to console with high priority
      console.error(`[SECURITY_ALERT] ${auditData.timestamp} - ${data.severity.toUpperCase()} - ${data.reason}`);

      // In production, send to security monitoring service
      if (process.env.NODE_ENV === 'production') {
        await this.sendSecurityAlert(auditData);
      }

    } catch (error) {
      console.error('Failed to log suspicious activity:', error);
    }
  }

  // Get key usage statistics
  async getKeyUsageStats(keyType?: string, days: number = 30) {
    try {
      const whereClause = keyType ? `AND metadata->>'key_type' = '${keyType}'` : '';
      
      const stats = await sql`
        SELECT 
          metadata->>'key_type' as key_type,
          COUNT(*) as total_requests,
          SUM(CASE WHEN success = true THEN 1 ELSE 0 END) as successful_requests,
          AVG(CAST(metadata->>'response_time_ms' AS FLOAT)) as avg_response_time,
          MAX(created_at) as last_used
        FROM audit_log 
        WHERE event_type = 'KEY_ACCESS'
          AND created_at >= NOW() - INTERVAL '${days} days'
          ${sql.raw(whereClause)}
        GROUP BY metadata->>'key_type'
        ORDER BY total_requests DESC
      `;

      return stats;
    } catch (error) {
      console.error('Failed to get key usage stats:', error);
      return [];
    }
  }

  private async sendSecurityAlert(auditData: any) {
    // Implement integration with security monitoring service
    // e.g., send to Slack, PagerDuty, or security team email
    console.log('[SECURITY_MONITORING]', auditData);
  }
}

export const keyAuditLogger = KeyAuditLogger.getInstance();
