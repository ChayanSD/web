import { neon } from "@neondatabase/serverless";

const NullishQueryFunction = () => {
  throw new Error(
    "No database connection string was provided to `neon()`. Perhaps process.env.DATABASE_URL has not been set",
  );
};
NullishQueryFunction.transaction = () => {
  throw new Error(
    "No database connection string was provided to `neon()`. Perhaps process.env.DATABASE_URL has not been set",
  );
};
const sql = process.env.DATABASE_URL
  ? neon(process.env.DATABASE_URL)
  : NullishQueryFunction;

// Helper to create a scoped query function that automatically adds user_id
// Note: This is a placeholder - not currently used in the codebase
export function withUser(userId) {
  // Return a callable function compatible with sql`` syntax
  const scopedSql = function() {
    if (arguments.length === 0) return sql();
    const args = Array.from(arguments);
    const firstArg = args[0];
    
    // If using template literal syntax, sql will be called with template array
    if (Array.isArray(firstArg)) {
      // Template literal usage - neon handles this automatically
      return sql.apply(null, arguments);
    }
    
    // Regular function call
    return sql.apply(null, arguments);
  };
  
  return scopedSql;
}

export default sql;
