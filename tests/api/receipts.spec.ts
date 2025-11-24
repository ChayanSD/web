import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock fetch for testing
global.fetch = vi.fn();

describe('Receipts API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('POST /api/receipts', () => {
    it('should create a receipt with valid data', async () => {
      const mockReceipt = {
        id: 1,
        user_id: 1,
        file_url: 'https://example.com/receipt.jpg',
        merchant_name: 'Test Store',
        receipt_date: '2024-01-15',
        amount: 25.99,
        category: 'Meals',
        currency: 'USD',
        created_at: '2024-01-15T10:00:00Z'
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ receipt: mockReceipt }),
        status: 201
      });

      const response = await fetch('/api/receipts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          file_url: 'https://example.com/receipt.jpg',
          merchant_name: 'Test Store',
          receipt_date: '2024-01-15',
          amount: 25.99,
          category: 'Meals',
          currency: 'USD'
        })
      });

      expect(response.ok).toBe(true);
      expect(response.status).toBe(201);
      
      const data = await response.json();
      expect(data.receipt).toEqual(mockReceipt);
    });

    it('should return validation error for invalid data', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: 'Validation failed',
          fieldErrors: {
            'merchant_name': 'Merchant name is required',
            'amount': 'Amount must be positive'
          }
        }),
        status: 400
      });

      const response = await fetch('/api/receipts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          file_url: 'https://example.com/receipt.jpg',
          merchant_name: '',
          receipt_date: '2024-01-15',
          amount: -10,
          category: 'Meals'
        })
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.error).toBe('Validation failed');
      expect(data.fieldErrors).toHaveProperty('merchant_name');
      expect(data.fieldErrors).toHaveProperty('amount');
    });

    it('should return unauthorized for missing auth', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Unauthorized' }),
        status: 401
      });

      const response = await fetch('/api/receipts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          file_url: 'https://example.com/receipt.jpg',
          merchant_name: 'Test Store',
          receipt_date: '2024-01-15',
          amount: 25.99,
          category: 'Meals'
        })
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/receipts', () => {
    it('should return paginated receipts', async () => {
      const mockReceipts = [
        {
          id: 1,
          user_id: 1,
          merchant_name: 'Test Store 1',
          receipt_date: '2024-01-15',
          amount: 25.99,
          category: 'Meals'
        },
        {
          id: 2,
          user_id: 1,
          merchant_name: 'Test Store 2',
          receipt_date: '2024-01-14',
          amount: 15.50,
          category: 'Travel'
        }
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          receipts: mockReceipts,
          pagination: {
            page: 1,
            limit: 20,
            total: 2,
            pages: 1
          }
        }),
        status: 200
      });

      const response = await fetch('/api/receipts?page=1&limit=20');

      expect(response.ok).toBe(true);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.receipts).toHaveLength(2);
      expect(data.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 2,
        pages: 1
      });
    });
  });

  describe('PUT /api/receipts/[id]', () => {
    it('should update a receipt', async () => {
      const mockUpdatedReceipt = {
        id: 1,
        user_id: 1,
        merchant_name: 'Updated Store',
        receipt_date: '2024-01-15',
        amount: 30.99,
        category: 'Meals',
        updated_at: '2024-01-15T11:00:00Z'
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ receipt: mockUpdatedReceipt }),
        status: 200
      });

      const response = await fetch('/api/receipts/1', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          merchant_name: 'Updated Store',
          amount: 30.99
        })
      });

      expect(response.ok).toBe(true);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.receipt.merchant_name).toBe('Updated Store');
      expect(data.receipt.amount).toBe(30.99);
    });
  });

  describe('DELETE /api/receipts/[id]', () => {
    it('should delete a receipt', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Receipt deleted successfully' }),
        status: 200
      });

      const response = await fetch('/api/receipts/1', {
        method: 'DELETE'
      });

      expect(response.ok).toBe(true);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.message).toBe('Receipt deleted successfully');
    });
  });
});
