import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock fetch for testing
global.fetch = vi.fn();

describe('Reports API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('POST /api/reports', () => {
    it('should create a PDF report with valid data', async () => {
      const mockReport = {
        id: 1,
        user_id: 1,
        period_start: '2024-01-01',
        period_end: '2024-01-31',
        title: 'January 2024 Expenses',
        total_amount: 150.75,
        pdf_url: 'https://example.com/report.pdf',
        receipt_count: 5,
        created_at: '2024-01-31T10:00:00Z'
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          report: mockReport,
          download_url: 'https://example.com/report.pdf',
          filename: 'expense-report-2024-01-01-to-2024-01-31.pdf',
          total_amount: 150.75,
          receipt_count: 5,
          pages: 2,
          template_used: 'Classic'
        }),
        status: 200
      });

      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          receipt_ids: [1, 2, 3, 4, 5],
          period_start: '2024-01-01',
          period_end: '2024-01-31',
          title: 'January 2024 Expenses',
          format: 'pdf'
        })
      });

      expect(response.ok).toBe(true);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.report).toEqual(mockReport);
      expect(data.download_url).toBe('https://example.com/report.pdf');
      expect(data.total_amount).toBe(150.75);
      expect(data.receipt_count).toBe(5);
    });

    it('should create a CSV report', async () => {
      const mockReport = {
        id: 2,
        user_id: 1,
        period_start: '2024-01-01',
        period_end: '2024-01-31',
        total_amount: 150.75,
        csv_url: 'data:text/csv;base64,CSV_DATA',
        receipt_count: 5
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          report: mockReport,
          download_url: 'data:text/csv;base64,CSV_DATA',
          filename: 'expense-report-2024-01-01-to-2024-01-31.csv',
          total_amount: 150.75,
          receipt_count: 5
        }),
        status: 200
      });

      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          receipt_ids: [1, 2, 3, 4, 5],
          period_start: '2024-01-01',
          period_end: '2024-01-31',
          format: 'csv'
        })
      });

      expect(response.ok).toBe(true);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.report).toEqual(mockReport);
      expect(data.filename).toContain('.csv');
    });

    it('should return validation error for invalid data', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: 'Validation failed',
          fieldErrors: {
            'receipt_ids': 'At least one receipt must be selected',
            'period_start': 'Start date must be in YYYY-MM-DD format'
          }
        }),
        status: 400
      });

      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          receipt_ids: [],
          period_start: 'invalid-date',
          period_end: '2024-01-31',
          format: 'pdf'
        })
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.error).toBe('Validation failed');
      expect(data.fieldErrors).toHaveProperty('receipt_ids');
      expect(data.fieldErrors).toHaveProperty('period_start');
    });

    it('should return error for no receipts found', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: 'No receipts found for the selected period'
        }),
        status: 400
      });

      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          receipt_ids: [999],
          period_start: '2024-01-01',
          period_end: '2024-01-31',
          format: 'pdf'
        })
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.error).toBe('No receipts found for the selected period');
    });
  });

  describe('GET /api/reports', () => {
    it('should return user reports', async () => {
      const mockReports = [
        {
          id: 1,
          user_id: 1,
          period_start: '2024-01-01',
          period_end: '2024-01-31',
          title: 'January 2024',
          total_amount: 150.75,
          created_at: '2024-01-31T10:00:00Z'
        },
        {
          id: 2,
          user_id: 1,
          period_start: '2024-02-01',
          period_end: '2024-02-28',
          title: 'February 2024',
          total_amount: 200.25,
          created_at: '2024-02-28T10:00:00Z'
        }
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ reports: mockReports }),
        status: 200
      });

      const response = await fetch('/api/reports');

      expect(response.ok).toBe(true);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.reports).toHaveLength(2);
      expect(data.reports[0].title).toBe('January 2024');
      expect(data.reports[1].title).toBe('February 2024');
    });
  });
});
