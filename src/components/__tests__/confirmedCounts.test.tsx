import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Briefcase } from 'lucide-react';
import { StatsGrid } from '@/components/StatsGrid';

describe('bekräftade siffror vid kallstart', () => {
  beforeEach(() => {
    localStorage.setItem('counter_emp_total_jobs', '31');
    localStorage.setItem('counter_emp_expired_jobs', '9');
  });
  afterEach(() => {
    cleanup();
    localStorage.removeItem('counter_emp_total_jobs');
    localStorage.removeItem('counter_emp_expired_jobs');
  });

  it('visar varken gammal cache eller mellanvärden före serverns svar', () => {
    const stats = [{ icon: Briefcase, title: 'Annonser', value: 0, isLoading: true, cacheKey: 'emp_total_jobs',
      subItems: [{ label: 'Utgångna', value: 0, cacheKey: 'emp_expired_jobs' }] }];
    const { container, rerender } = render(<StatsGrid stats={stats} />);
    expect(container.textContent).not.toContain('31');
    expect(container.textContent).not.toContain('9');
    rerender(<StatsGrid stats={[{ ...stats[0], value: 41, isLoading: false, subItems: [{ ...stats[0].subItems[0], value: 2 }] }]} />);
    expect(screen.getAllByText('41').length).toBeGreaterThan(0);
    expect(screen.getAllByText('2').length).toBeGreaterThan(0);
    expect(container.textContent).not.toContain('31');
  });
});