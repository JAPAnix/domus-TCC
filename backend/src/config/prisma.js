
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../../generated/prisma/client.js";


const adapter = new PrismaMariaDb({
  // O MySQL do XAMPP normalmente escuta em IPv4; "localhost" pode resolver
  // para ::1 e falhar mesmo com o servidor disponível em 127.0.0.1.
  host: process.env.DATABASE_HOST === 'localhost' ? '127.0.0.1' : process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT) || 3306,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  connectionLimit: 5,
});
const prisma = new PrismaClient({ adapter });

export { prisma };
