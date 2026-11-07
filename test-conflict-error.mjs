// Test to verify ConflictError is working
import { ConflictError } from "../src/lib/errors";

try {
  throw new ConflictError("Test message");
} catch (error) {
  if (error instanceof ConflictError) {
    console.log("✓ ConflictError caught");
    console.log("  Message:", error.message);
    console.log("  Status:", error.status);
  } else {
    console.log("✗ Not a ConflictError");
  }
}
