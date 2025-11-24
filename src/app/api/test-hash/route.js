import { hash } from "argon2";

export async function POST(request) {
  try {
    const { password } = await request.json();
    const hashedPassword = await hash(password);

    return Response.json({ hashedPassword });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
