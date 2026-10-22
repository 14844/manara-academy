export async function GET() {
    return new Response("google-site-verification: googlec964b7e72c9a3e7d.html", {
        headers: {
            "Content-Type": "text/html; charset=utf-8",
        },
    });
}
