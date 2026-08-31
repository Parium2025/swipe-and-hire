// @vitest-environment jsdom

import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';
import AuthSelectField from '@/components/auth/AuthSelectField';
import { SlidingTabs } from '@/components/ui/sliding-tabs';

describe('Auth controls accessibility', () => {
  it('exposes login/register as a keyboard-operable tab set', () => {
    const onTabChange = vi.fn();
    render(<SlidingTabs isLogin onTabChange={onTabChange} />);

    const login = screen.getByRole('tab', { name: 'Logga in' });
    const signup = screen.getByRole('tab', { name: 'Registrera' });

    expect(screen.getByRole('tablist', { name: 'Autentiseringsläge' })).toBeInTheDocument();
    expect(login).toHaveAttribute('aria-selected', 'true');
    expect(login).toHaveAttribute('id', 'auth-login-tab');
    expect(login).toHaveAttribute('aria-controls', 'auth-login-panel');
    expect(login).toHaveAttribute('tabindex', '0');
    expect(signup).toHaveAttribute('aria-selected', 'false');
    expect(signup).toHaveAttribute('id', 'auth-signup-tab');
    expect(signup).toHaveAttribute('aria-controls', 'auth-signup-panel');
    expect(signup).toHaveAttribute('tabindex', '-1');

    fireEvent.keyDown(login, { key: 'ArrowRight' });
    expect(onTabChange).toHaveBeenCalledWith('signup');
  });

  it('opens, navigates and selects an option with the keyboard', () => {
    const onChange = vi.fn();
    render(
      <AuthSelectField
        id="company-size"
        label="Företagsstorlek"
        placeholder="Välj storlek"
        value=""
        options={['1–10', '11–50', '51–200']}
        onChange={onChange}
      />,
    );

    const combobox = screen.getByRole('combobox', { name: /Företagsstorlek/i });
    expect(combobox).toHaveAttribute('aria-expanded', 'false');

    fireEvent.keyDown(combobox, { key: 'ArrowDown' });
    expect(combobox).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('listbox', { name: 'Företagsstorlek' })).toBeInTheDocument();

    fireEvent.keyDown(combobox, { key: 'ArrowDown' });
    fireEvent.keyDown(combobox, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('11–50');
  });

  it('closes an open selector with Escape without changing the value', () => {
    const onChange = vi.fn();
    render(
      <AuthSelectField
        id="industry"
        label="Bransch"
        placeholder="Välj bransch"
        value="Teknik"
        options={['Teknik', 'Vård']}
        onChange={onChange}
      />,
    );

    const combobox = screen.getByRole('combobox', { name: /Bransch/i });
    fireEvent.keyDown(combobox, { key: 'Enter' });
    fireEvent.keyDown(combobox, { key: 'Escape' });

    expect(combobox).toHaveAttribute('aria-expanded', 'false');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('bounds custom searchable values', () => {
    render(
      <AuthSelectField
        id="industry"
        label="Bransch"
        placeholder="Välj bransch"
        value=""
        options={[]}
        onChange={vi.fn()}
        searchable
        allowCustom
        maxLength={120}
      />,
    );

    fireEvent.click(screen.getByRole('combobox', { name: /Bransch/i }));
    expect(screen.getByRole('searchbox')).toHaveAttribute('maxlength', '120');
  });

  it('keeps the search input outside the listbox option tree', () => {
    render(
      <AuthSelectField
        id="industry"
        label="Bransch"
        placeholder="Välj bransch"
        value=""
        options={['Teknik', 'Vård']}
        onChange={vi.fn()}
        searchable
      />,
    );

    fireEvent.click(screen.getByRole('combobox', { name: /Bransch/i }));
    const listbox = screen.getByRole('listbox', { name: 'Bransch' });

    expect(screen.getByRole('searchbox')).toBeInTheDocument();
    expect(within(listbox).queryByRole('searchbox')).not.toBeInTheDocument();
  });

  it('lets keyboard users select a filtered option from the search field', () => {
    const onChange = vi.fn();
    render(
      <AuthSelectField
        id="industry"
        label="Bransch"
        placeholder="Välj bransch"
        value=""
        options={['Teknik', 'Vård']}
        onChange={onChange}
        searchable
      />,
    );

    fireEvent.click(screen.getByRole('combobox', { name: /Bransch/i }));
    const search = screen.getByRole('searchbox');
    fireEvent.change(search, { target: { value: 'Vå' } });
    fireEvent.keyDown(search, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith('Vård');
  });

  it('exposes a custom searchable value as the active listbox option', () => {
    render(
      <AuthSelectField
        id="industry"
        label="Bransch"
        placeholder="Välj bransch"
        value=""
        options={[]}
        onChange={vi.fn()}
        searchable
        allowCustom
      />,
    );

    fireEvent.click(screen.getByRole('combobox', { name: /Bransch/i }));
    const search = screen.getByRole('searchbox');
    fireEvent.change(search, { target: { value: 'Rymdteknik' } });

    const customOption = screen.getByRole('option', { name: 'Använd "Rymdteknik"' });
    expect(customOption).toHaveAttribute('id', 'industry-custom-option');
    expect(customOption).toHaveAttribute('aria-selected', 'false');
    expect(search).toHaveAttribute('aria-activedescendant', 'industry-custom-option');
  });
});
