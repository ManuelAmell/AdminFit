import "dotenv/config";
import "@testing-library/jest-dom/vitest";

process.env.DATABASE_URL ||= "postgresql://postgres:postgres@localhost:5432/test";
