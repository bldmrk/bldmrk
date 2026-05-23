export interface SiteContext {
  id: string           // e.g. "site-a.com"
  contentDir: string   // absolute path to sites/site-a.com/content/
  configDir: string    // absolute path to sites/site-a.com/
  domain: string       // "site-a.com"
  aliases: string[]    // ["www.site-a.com"]
}
