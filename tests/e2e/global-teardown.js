/**
 * Global teardown for the E2E harness.
 *
 * This deliberately does NOT stop the Supabase stack.
 *
 * `supabase stop --no-backup` means "Deletes all data volumes after stopping"
 * (`supabase stop --help`), so running the suite on a machine with the stack up
 * would destroy the local development database — and it buys nothing. Global
 * setup starts the stack, but teardown should not tear down infrastructure it
 * did not create: the developer may have started it themselves, and on a CI
 * runner the instance is ephemeral anyway.
 *
 * Leaving the stack running also keeps the next run fast, which is the opposite
 * of what the flag it replaced was commented as doing.
 */
export default async function globalTeardown() {
  console.log(
    '[global-teardown] Leaving the Supabase stack running. ' +
      'Stop it yourself with `supabase stop` when you no longer need it.'
  );
}