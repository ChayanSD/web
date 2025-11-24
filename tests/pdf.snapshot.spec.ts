import { describe, it, expect } from 'vitest';
import { generateHTML } from '../src/app/api/exports/pdf/utils/htmlTemplates';

describe('PDF Template Snapshot Tests', () => {
  const mockData = {
    reportMeta: {
      period_start: '2024-01-01',
      period_end: '2024-01-31',
      generated_at: '2024-01-31T10:00:00Z',
      report_id: 'RPT-202401-001',
      timezone: 'America/Chicago',
      locale: 'en-US',
      currency: 'USD',
    },
    submitter: {
      name: 'John Doe',
      email: 'john.doe@example.com',
      title: 'Software Engineer',
      department: 'Engineering',
      employee_id: 'EMP-123',
    },
    recipient: {
      company_name: 'Acme Corp',
      approver_name: 'Jane Smith',
      approver_email: 'jane.smith@acme.com',
      address_lines: ['123 Business St', 'San Francisco, CA 94105'],
    },
    branding: {
      primary_color: '#2E86DE',
      accent_color: '#10B981',
      neutral_bg: '#F7F8FA',
      font_heading: 'Poppins',
      font_body: 'Inter',
      template: 'Classic',
    },
    policy: {
      title: 'Expense Reimbursement Policy',
      notes: [
        'Submit receipts within 30 days',
        'Business expenses only',
        'Approval required for amounts over $100',
      ],
      violations: [],
    },
    summary: {
      totals_by_category: [
        { category: 'Meals', amount: 125.50 },
        { category: 'Travel', amount: 300.00 },
        { category: 'Supplies', amount: 45.25 },
      ],
      total_reimbursable: 470.75,
      non_reimbursable: 0.0,
      per_diem_days: 0,
      per_diem_rate: 0.0,
      tax: 0.0,
    },
    line_items: [
      {
        receipt_id: 1,
        date: '2024-01-15',
        merchant: 'Starbucks',
        category: 'Meals',
        amount: 5.50,
        currency: 'USD',
        converted_amount: 5.50,
        project_code: null,
        notes: 'Coffee meeting',
        policy_flag: false,
        file_url: 'https://example.com/receipt1.jpg',
      },
      {
        receipt_id: 2,
        date: '2024-01-20',
        merchant: 'Uber',
        category: 'Travel',
        amount: 15.75,
        currency: 'USD',
        converted_amount: 15.75,
        project_code: null,
        notes: 'Client meeting',
        policy_flag: false,
        file_url: 'https://example.com/receipt2.jpg',
      },
      {
        receipt_id: 3,
        date: '2024-01-25',
        merchant: 'Office Depot',
        category: 'Supplies',
        amount: 25.99,
        currency: 'USD',
        converted_amount: 25.99,
        project_code: null,
        notes: 'Office supplies',
        policy_flag: false,
        file_url: 'https://example.com/receipt3.jpg',
      },
    ],
    appendix: {
      include_receipt_gallery: false,
      receipt_images: [],
    },
    signoff: {
      submitter_signature_text: 'I certify that these expenses are accurate and incurred for work-related purposes.',
      approver_signature_placeholder: true,
    },
    title: 'January 2024 Expense Report',
  };

  it('should generate consistent HTML for Classic template', () => {
    const html = generateHTML(mockData);
    
    // Check that essential elements are present
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html>');
    expect(html).toContain('<head>');
    expect(html).toContain('<title>ReimburseMe Expense Report - RPT-202401-001</title>');
    expect(html).toContain('<body>');
    
    // Check header elements
    expect(html).toContain('ReimburseMe');
    expect(html).toContain('Your receipts. Reimbursed. Instantly.');
    expect(html).toContain('RPT-202401-001');
    
    // Check submitter information
    expect(html).toContain('John Doe');
    expect(html).toContain('john.doe@example.com');
    expect(html).toContain('Software Engineer');
    expect(html).toContain('Engineering');
    
    // Check recipient information
    expect(html).toContain('Acme Corp');
    expect(html).toContain('Jane Smith');
    expect(html).toContain('jane.smith@acme.com');
    
    // Check summary section
    expect(html).toContain('Summary Overview');
    expect(html).toContain('$470.75');
    expect(html).toContain('3');
    
    // Check line items
    expect(html).toContain('Starbucks');
    expect(html).toContain('Uber');
    expect(html).toContain('Office Depot');
    expect(html).toContain('$5.50');
    expect(html).toContain('$15.75');
    expect(html).toContain('$25.99');
    
    // Check category breakdown
    expect(html).toContain('Category Breakdown');
    expect(html).toContain('Meals');
    expect(html).toContain('Travel');
    expect(html).toContain('Supplies');
    
    // Check sign-off section
    expect(html).toContain('I certify that these expenses are accurate and incurred for work-related purposes');
    expect(html).toContain('Employee Signature');
    expect(html).toContain('Approver Signature');
    
    // Check footer
    expect(html).toContain('ReimburseMe ©');
    expect(html).toContain('www.reimburseme.app');
    
    // Check that all dates are properly formatted
    expect(html).toContain('Jan 1, 2024');
    expect(html).toContain('Jan 31, 2024');
    expect(html).toContain('Jan 15, 2024');
    expect(html).toContain('Jan 20, 2024');
    expect(html).toContain('Jan 25, 2024');
  });

  it('should handle empty line items gracefully', () => {
    const dataWithNoItems = {
      ...mockData,
      line_items: [],
      summary: {
        ...mockData.summary,
        total_reimbursable: 0,
        totals_by_category: [],
      },
    };

    const html = generateHTML(dataWithNoItems);
    
    expect(html).toContain('$0.00');
    expect(html).toContain('0');
    expect(html).not.toContain('Starbucks');
    expect(html).not.toContain('Uber');
  });

  it('should handle missing optional fields', () => {
    const minimalData = {
      reportMeta: mockData.reportMeta,
      submitter: {
        name: 'Test User',
        email: 'test@example.com',
        title: '',
        department: '',
        employee_id: '',
      },
      recipient: {
        company_name: 'Test Company',
        approver_name: '',
        approver_email: '',
        address_lines: [],
      },
      branding: mockData.branding,
      policy: mockData.policy,
      summary: {
        totals_by_category: [],
        total_reimbursable: 0,
        non_reimbursable: 0,
        per_diem_days: 0,
        per_diem_rate: 0,
        tax: 0,
      },
      line_items: [],
      appendix: {
        include_receipt_gallery: false,
        receipt_images: [],
      },
      signoff: {
        submitter_signature_text: 'I certify these expenses are accurate.',
        approver_signature_placeholder: true,
      },
    };

    const html = generateHTML(minimalData);
    
    expect(html).toContain('Test User');
    expect(html).toContain('test@example.com');
    expect(html).toContain('Test Company');
    expect(html).toContain('I certify these expenses are accurate.');
  });

  it('should escape HTML in user input', () => {
    const dataWithHtml = {
      ...mockData,
      submitter: {
        ...mockData.submitter,
        name: 'John <script>alert("xss")</script> Doe',
      },
      line_items: [
        {
          ...mockData.line_items[0],
          merchant: 'Test & Co. <b>Bold</b>',
          notes: 'Notes with <em>HTML</em>',
        },
      ],
    };

    const html = generateHTML(dataWithHtml);
    
    // Should not contain unescaped HTML
    expect(html).not.toContain('<script>alert("xss")</script>');
    expect(html).not.toContain('<b>Bold</b>');
    expect(html).not.toContain('<em>HTML</em>');
    
    // Should contain escaped HTML
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;b&gt;Bold&lt;/b&gt;');
    expect(html).toContain('&lt;em&gt;HTML&lt;/em&gt;');
  });
});
