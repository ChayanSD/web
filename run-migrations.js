#!/usr/bin/env node

import { Pool } from "@neondatabase/serverless";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file manually if it exists
try {
  const envPath = join(__dirname, "../../.env");
  const envContent = readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
} catch (err) {
  // .env file doesn't exist or can't be read, that's okay
}

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL environment variable not set");
  console.error("Please set your database URL:");
  console.error("export DATABASE_URL='postgresql://username:password@hostname:port/database'");
  process.exit(1);
}

console.log("🚀 ReimburseMe Database Migrations");
console.log("====================================");
console.log("✅ DATABASE_URL is set\n");

const pool = new Pool({ connectionString: DATABASE_URL });

function splitSQL(sqlContent) {
  const statements = [];
  let currentStatement = '';
  let inDollarQuote = false;
  let dollarTag = null;
  let depth = 0;
  
  for (let i = 0; i < sqlContent.length; i++) {
    const char = sqlContent[i];
    const nextFew = sqlContent.slice(i, i + 10);
    
    // Detect start of dollar-quoted string ($$ or $tag$)
    if (!inDollarQuote && char === '$') {
      const match = sqlContent.slice(i).match(/^\$([^$]*)\$/);
      if (match) {
        dollarTag = match[0];
        inDollarQuote = true;
        currentStatement += dollarTag;
        i += dollarTag.length - 1;
        continue;
      }
    }
    
    // Inside dollar-quoted string
    if (inDollarQuote) {
      // Check if we've reached the closing tag (before adding current char)
      if (sqlContent.slice(i).startsWith(dollarTag)) {
        currentStatement += dollarTag;
        i += dollarTag.length - 1;
        inDollarQuote = false;
        dollarTag = null;
        continue;
      }
      currentStatement += char;
      continue;
    }
    
    currentStatement += char;
    
    // Check for semicolon outside of dollar quotes
    if (char === ';' && !inDollarQuote) {
      const trimmed = currentStatement.trim();
      if (trimmed && !trimmed.startsWith('--')) {
        statements.push(trimmed);
      }
      currentStatement = '';
    }
  }
  
  // Add any remaining statement
  const trimmed = currentStatement.trim();
  if (trimmed && !trimmed.startsWith('--')) {
    statements.push(trimmed);
  }
  
  return statements.filter(s => s.trim());
}

async function runMigration(filePath, description) {
  console.log(`📊 ${description}...`);
  
  let sqlContent;
  try {
    sqlContent = readFileSync(filePath, "utf-8");
  } catch (readError) {
    console.error(`❌ Error reading ${filePath}:`);
    console.error(readError.message);
    return false;
  }
  
  try {
    // Split SQL into individual statements
    const statements = splitSQL(sqlContent);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim();
      if (!statement || statement.startsWith('--')) {
        continue;
      }
      
      try {
        await pool.query(statement);
      } catch (err) {
        // Some errors are expected (like "already exists")
        if (err.message.includes('already exists') || 
            err.message.includes('does not exist') ||
            err.message.includes('duplicate')) {
          // These are okay, continue
          continue;
        }
        throw err;
      }
    }
    
    console.log(`✅ ${description} completed\n`);
    return true;
  } catch (error) {
    console.error(`❌ Error running ${description}:`);
    console.error(error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    return false;
  }
}

async function verifyTables() {
  console.log("🔍 Verifying database schema...");
  
  try {
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('auth_users', 'receipts', 'reports', 'subscription_usage', 'subscription_events', 'subscription_tiers')
      ORDER BY table_name
    `);
    const tables = result.rows;
    
    if (tables.length > 0) {
      console.log("✅ Found tables:");
      tables.forEach(table => {
        console.log(`   - ${table.table_name}`);
      });
      console.log("");
      return true;
    } else {
      console.error("❌ No expected tables found");
      return false;
    }
  } catch (error) {
    console.error(`❌ Error verifying tables: ${error.message}`);
    return false;
  }
}

async function main() {
  const bootstrapPath = join(__dirname, "db/bootstrap.sql");
  const subscriptionPath = join(__dirname, "db/2025_01_28_subscription.sql");
  
  // Run bootstrap migration
  const bootstrapSuccess = await runMigration(bootstrapPath, "Running bootstrap SQL");
  if (!bootstrapSuccess) {
    console.error("❌ Bootstrap migration failed");
    process.exit(1);
  }
  
  // Run subscription migration
  const subscriptionSuccess = await runMigration(subscriptionPath, "Running subscription migration");
  if (!subscriptionSuccess) {
    console.error("❌ Subscription migration failed");
    process.exit(1);
  }
  
  // Verify tables
  const verificationSuccess = await verifyTables();
  if (!verificationSuccess) {
    console.error("❌ Database schema verification failed");
    process.exit(1);
  }
  
  console.log("🎉 Database migrations completed successfully!");
  console.log("");
  console.log("Next steps:");
  console.log("1. Set environment variables in Vercel dashboard");
  console.log("2. Create Stripe products and prices");
  console.log("3. Configure Stripe webhooks");
  console.log("4. Deploy to Vercel");
}

main().catch(error => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
}).finally(() => {
  pool.end();
});

