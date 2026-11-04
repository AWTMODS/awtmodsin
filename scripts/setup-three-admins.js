const { Pool } = require("pg");

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://postgres:jwp0MTihsHDJUQb3@db.uzmskxruuvfgokststox.supabase.co:5432/postgres",
  ssl: { rejectUnauthorized: false },
});

/**
 * Provision an administrator account (max 3 total accounts enforced by DB trigger)
 * Usage: node scripts/setup-three-admins.js <email> <password> [role]
 */
async function provisionAdmin(email, password, role = "admin") {
  if (!email || !password) {
    console.error("Usage: node scripts/setup-three-admins.js <email> <password> [role]");
    process.exit(1);
  }

  const cleanEmail = email.toLowerCase().trim();
  const cleanRole = role === "superadmin" ? "superadmin" : "admin";

  try {
    // 1. Check current count in public.admins
    const countRes = await pool.query("SELECT COUNT(*) as count FROM public.admins;");
    const currentCount = parseInt(countRes.rows[0].count, 10);
    console.log(`Current administrator count: ${currentCount}/3`);

    // Check if user already exists
    const existingAdmin = await pool.query(
      "SELECT id, role, is_active FROM public.admins WHERE lower(email) = lower($1);",
      [cleanEmail]
    );

    if (existingAdmin.rows.length === 0 && currentCount >= 3) {
      console.error("Error: Maximum limit of 3 administrator accounts reached.");
      process.exit(1);
    }

    // 2. Upsert in auth.users
    const userRes = await pool.query(
      "SELECT id FROM auth.users WHERE lower(email) = lower($1);",
      [cleanEmail]
    );

    let authUserId;
    if (userRes.rows.length > 0) {
      authUserId = userRes.rows[0].id;
      await pool.query(
        `
        UPDATE auth.users
        SET encrypted_password = crypt($1, gen_salt('bf', 10)),
            email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
            updated_at = NOW()
        WHERE id = $2;
        `,
        [password.trim(), authUserId]
      );
      console.log(`Updated auth.users credentials for: ${cleanEmail}`);
    } else {
      const insertUserRes = await pool.query(
        `
        INSERT INTO auth.users (
          instance_id,
          id,
          aud,
          role,
          email,
          encrypted_password,
          email_confirmed_at,
          created_at,
          updated_at,
          raw_app_meta_data,
          raw_user_meta_data,
          is_super_admin
        )
        VALUES (
          '00000000-0000-00-00-000000000000',
          gen_random_uuid(),
          'authenticated',
          'authenticated',
          $1,
          crypt($2, gen_salt('bf', 10)),
          NOW(),
          NOW(),
          NOW(),
          '{"provider": "email", "providers": ["email"]}',
          '{}',
          false
        )
        RETURNING id;
        `,
        [cleanEmail, password.trim()]
      );
      authUserId = insertUserRes.rows[0].id;
      console.log(`Created auth.users account for: ${cleanEmail} (ID: ${authUserId})`);
    }

    // 3. Upsert in public.admins
    await pool.query(
      `
      INSERT INTO public.admins (auth_user_id, email, role, is_active)
      VALUES ($1, $2, $3, true)
      ON CONFLICT (email) DO UPDATE
      SET auth_user_id = EXCLUDED.auth_user_id,
          role = EXCLUDED.role,
          is_active = true;
      `,
      [authUserId, cleanEmail, cleanRole]
    );

    console.log(`Successfully provisioned administrator: ${cleanEmail} (${cleanRole})`);

    // 4. List all active administrators
    const allAdmins = await pool.query(
      "SELECT id, email, role, is_active, created_at FROM public.admins ORDER BY created_at;"
    );
    console.log("\nCurrent Authorized Administrators:");
    console.table(allAdmins.rows);
  } catch (err) {
    console.error("Provisioning error:", err.message);
  } finally {
    await pool.end();
  }
}

const args = process.argv.slice(2);
provisionAdmin(args[0], args[1], args[2]);

