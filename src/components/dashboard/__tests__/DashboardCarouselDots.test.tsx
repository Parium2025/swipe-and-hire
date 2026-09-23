import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DashboardCarouselDots } from '../DashboardCarouselDots';

describe('DashboardCarouselDots', () => {
  it('visar högst fyra navigeringspunkter för tio poster', () => {
    render(
      <DashboardCarouselDots
        count={10}
        currentIndex={5}
        onSelect={vi.fn()}
        label="Visa intervju"
        maxVisible={4}
        alwaysRender
      />,
    );

    expect(screen.getAllByRole('button')).toHaveLength(4);
    expect(screen.getByRole('button', { name: 'Visa intervju 6' })).toHaveClass('bg-white');
  });

  it('öppnar rätt intervju när en synlig punkt väljs', () => {
    const onSelect = vi.fn();
    render(
      <DashboardCarouselDots
        count={10}
        currentIndex={8}
        onSelect={onSelect}
        label="Visa intervju"
        maxVisible={4}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Visa intervju 10' }));
    expect(onSelect).toHaveBeenCalledWith(9);
  });
});