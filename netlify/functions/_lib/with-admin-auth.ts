// Single implementation lives in admin-auth.js so the .js functions can import
// it too: Netlify ships .js functions as plain ES modules, where importing a
// .ts file fails at runtime.
export { withAdminAuth, requireAdminUser, adminCorsHeaders } from "./admin-auth.js";
