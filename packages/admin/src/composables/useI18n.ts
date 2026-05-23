import { useApi } from './useApi.js'

export interface I18nVariant {
  locale: string
  slug: string
}

interface PageData {
  i18n?: {
    locale?: string
    variants?: Record<string, string>
  }
}

interface PageResponse {
  slug: string
  data: PageData
}

/**
 * Composable for i18n / locale variant operations on pages.
 */
export function useI18n() {
  const api = useApi()

  /**
   * Returns the list of locale variants for a given page slug.
   * Reads the page data from the API and parses the i18n field.
   *
   * page.yaml i18n format:
   *   i18n:
   *     locale: en
   *     variants:
   *       de: /path/to/german-page
   *       fr: /path/to/french-page
   */
  async function getVariants(slug: string): Promise<I18nVariant[]> {
    try {
      const page = await api.get<PageResponse>(`/api/pages/${encodeURIComponent(slug)}`)
      const i18n = page?.data?.i18n
      if (!i18n) return []

      const variants: I18nVariant[] = []

      // Include own locale
      if (i18n.locale) {
        variants.push({ locale: i18n.locale, slug })
      }

      // Include all declared variants
      if (i18n.variants) {
        for (const [locale, variantSlug] of Object.entries(i18n.variants)) {
          if (!variants.some(v => v.locale === locale)) {
            variants.push({ locale, slug: variantSlug })
          }
        }
      }

      return variants
    } catch {
      return []
    }
  }

  return { getVariants }
}
