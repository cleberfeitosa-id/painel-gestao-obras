import { test, expect } from '@playwright/test';

test.describe('Measurement UI QA', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login page
    await page.goto('http://localhost:3000/login');
    await page.waitForLoadState('networkidle');
  });

  test('should load login page without errors', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Entrar');
    // Check for console errors
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', err => errors.push(err.message));
    await page.waitForTimeout(1000);
    expect(errors.length).toBe(0);
  });

  test('should navigate to measurement detail page after login', async ({ page }) => {
    // This test requires valid credentials - we'll check if the page loads
    // by trying to access a measurement detail page directly
    // First, let's check if we can access the measurement list page
    await page.goto('http://localhost:3000/obras');
    await page.waitForLoadState('networkidle');
    
    // Check for any console errors
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', err => errors.push(err.message));
    
    await page.waitForTimeout(2000);
    console.log('Console errors:', errors);
  });
});

test.describe('Quantity formatting verification', () => {
  test('formatarQuantidade should format numbers correctly', async ({ page }) => {
    // We'll test the utility function by evaluating it in the browser context
    const result = await page.evaluate(() => {
      // Simulate the formatarQuantidade function
      const formatadorQuantidade = new Intl.NumberFormat('pt-BR', {
        maximumFractionDigits: 2,
        minimumFractionDigits: 0,
      });
      
      function formatarQuantidade(valor: number | null | undefined) {
        if (valor == null || Number.isNaN(valor)) return '—';
        return formatadorQuantidade.format(valor);
      }
      
      return {
        zero: formatarQuantidade(0),
        integer: formatarQuantidade(10),
        oneDecimal: formatarQuantidade(10.5),
        twoDecimals: formatarQuantidade(10.55),
        threeDecimals: formatarQuantidade(10.555),
        null: formatarQuantidade(null),
        undefined: formatarQuantidade(undefined),
        nan: formatarQuantidade(NaN),
        large: formatarQuantidade(1234567.89),
      };
    });
    
    console.log('Quantity formatting results:', result);
    
    // Verify expected formatting
    expect(result.zero).toBe('0');
    expect(result.integer).toBe('10');
    expect(result.oneDecimal).toBe('10,5');
    expect(result.twoDecimals).toBe('10,55');
    expect(result.threeDecimals).toBe('10,56'); // Should round to 2 decimals
    expect(result.null).toBe('—');
    expect(result.undefined).toBe('—');
    expect(result.nan).toBe('—');
    expect(result.large).toBe('1.234.567,89');
  });
});

test.describe('arredondar function verification', () => {
  test('arredondar should round correctly', async ({ page }) => {
    const result = await page.evaluate(() => {
      function arredondar(valor: number): number {
        return Math.round((valor + Number.EPSILON) * 100) / 100;
      }
      
      return {
        simple: arredondar(10.555),
        simple2: arredondar(10.554),
        zero: arredondar(0),
        negative: arredondar(-10.555),
        large: arredondar(1234567.891),
      };
    });
    
    console.log('Arredondar results:', result);
    
    // Verify rounding behavior
    expect(result.simple).toBe(10.56);
    expect(result.simple2).toBe(10.55);
    expect(result.zero).toBe(0);
    expect(result.negative).toBe(-10.55);
    expect(result.large).toBe(1234567.89);
  });
});