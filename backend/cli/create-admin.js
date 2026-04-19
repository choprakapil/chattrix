const path = require("path");
const readline = require("readline");
const bcrypt = require("bcrypt");
const dotenv = require("dotenv");
const { query } = require("../src/db");

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (text) => new Promise((resolve) => rl.question(text, (v) => resolve(v.trim())));

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function run() {
  try {
    const name = await ask("Enter Admin Name: ");
    const email = await ask("Enter Admin Email: ");
    const password = await ask("Enter Admin Password: ");
    if (!name || !email || !password) throw new Error("All fields are required.");
    if (!validEmail(email)) throw new Error("Invalid email format.");
    const exists = await query("SELECT id FROM admins WHERE email = ?", [email.toLowerCase()]);
    if (exists.length) throw new Error("Admin already exists with this email.");
    const hash = await bcrypt.hash(password, 10);
    await query("INSERT INTO admins (name, email, password) VALUES (?, ?, ?)", [name, email.toLowerCase(), hash]);
    console.log("✅ Admin created successfully!");
  } catch (err) {
    console.error(`Error: ${err.message}`);
  } finally {
    rl.close();
    process.exit(0);
  }
}

run();
