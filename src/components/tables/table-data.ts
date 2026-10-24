// Shared row shape for the template's table variants.
//
// The template shipped two fake datasets (employees and performers) and each
// table rendered hardcoded fields. The gerencial page now feeds these rows
// from real CEMURM songs and setlists; `key` is the stable React key, `href`
// is the only action (open the row's real detail page). No add/edit/delete
// actions exist here because the admin surface does not implement them.
export type PerformerRow = {
  key: string
  title: string
  subtitle: string
  meta: string
  badge: string
  badgeClass: string
  href: string
}
