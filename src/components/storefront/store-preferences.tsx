"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import {
  formatDateFor,
  translate,
  type Locale,
  type MessageKey,
  type NumeralStyle,
} from "@/lib/i18n";
import { formatMoney } from "@/lib/money";

type StorePreferences = {
  locale: Locale;
  numerals: NumeralStyle;
  t: (key: MessageKey, values?: Record<string, string | number>) => string;
  money: (minor: number) => string;
  date: (value: Date | string, options?: Intl.DateTimeFormatOptions) => string;
};

const StorePreferencesContext = createContext<StorePreferences | null>(null);

export function StorePreferencesProvider({
  locale,
  numerals,
  children,
}: {
  locale: Locale;
  numerals: NumeralStyle;
  children: ReactNode;
}) {
  const value = useMemo<StorePreferences>(
    () => ({
      locale,
      numerals,
      t: (key, values) => translate(locale, key, values),
      money: (minor) => formatMoney(minor, { locale, numerals }),
      date: (date, options) => formatDateFor(date, locale, numerals, options),
    }),
    [locale, numerals],
  );

  return (
    <StorePreferencesContext.Provider value={value}>
      {children}
    </StorePreferencesContext.Provider>
  );
}

export function useStorePreferences(): StorePreferences {
  const value = useContext(StorePreferencesContext);
  if (!value) {
    throw new Error("useStorePreferences must be used inside the storefront provider.");
  }
  return value;
}
