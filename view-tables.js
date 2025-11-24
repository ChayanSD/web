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
  // .env file doesn't exist or can't be read
}

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL environment variable not set");
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

async function listTables() {
  try {
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log("\n📊 Database Tables:");
    console.log("===================\n");
    
    if (result.rows.length === 0) {
      console.log("No tables found.");
      return;
    }
    
    result.rows.forEach((row, index) => {
      console.log(`${index + 1}. ${row.table_name}`);
    });
    
    console.log(`\nTotal: ${result.rows.length} tables\n`);
  } catch (error) {
    console.error("❌ Error listing tables:", error.message);
  }
}

async function viewTable(tableName) {
  try {
    // Get table structure
    const structureResult = await pool.query(`
      SELECT 
        column_name,
        data_type,
        character_maximum_length,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = $1
      ORDER BY ordinal_position
    `, [tableName]);
    
    // Get row count
    const countResult = await pool.query(`SELECT COUNT(*) as count FROM ${tableName}`);
    const rowCount = countResult.rows[0].count;
    
    console.log(`\n📋 Table: ${tableName}`);
    console.log("=".repeat(60));
    console.log(`Rows: ${rowCount}\n`);
    console.log("Columns:");
    console.log("-".repeat(60));
    
    structureResult.rows.forEach(col => {
      const maxLength = col.character_maximum_length ? `(${col.character_maximum_length})` : '';
      const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
      console.log(`  • ${col.column_name.padEnd(25)} ${col.data_type}${maxLength} ${nullable}${defaultVal}`);
    });
    
    // Get sample data (first 5 rows)
    if (rowCount > 0) {
      const dataResult = await pool.query(`SELECT * FROM ${tableName} LIMIT 5`);
      console.log(`\nSample Data (showing first ${Math.min(5, rowCount)} rows):`);
      console.log("-".repeat(60));
      
      if (dataResult.rows.length > 0) {
        // Print headers
        const headers = Object.keys(dataResult.rows[0]);
        console.log(headers.join(' | '));
        console.log("-".repeat(60));
        
        // Print rows
        dataResult.rows.forEach(row => {
          const values = headers.map(h => {
            const val = row[h];
            if (val === null) return 'NULL';
            if (typeof val === 'object') return JSON.stringify(val).substring(0, 30);
            return String(val).substring(0, 30);
          });
          console.log(values.join(' | '));
        });
      }
    }
    
    console.log("\n");
  } catch (error) {
    console.error(`❌ Error viewing table ${tableName}:`, error.message);
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    // Just list all tables
    await listTables();
    console.log("💡 Tip: Run with a table name to see details:");
    console.log("   node view-tables.js auth_users");
    console.log("   node view-tables.js receipts\n");
  } else {
    // View specific table
    const tableName = args[0];
    await viewTable(tableName);
  }
  
  await pool.end();
}

main().catch(error => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});


