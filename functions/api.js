export async function onRequest(context) {
    const data = {
        "active": "firebase",
        "firebase": {
            "apiKey": "AIzaSyBIW_YWb2VlQsTArOV7fK2li4Aux8X0ucY",
            "authDomain": "knifeblackstore-1791.firebaseapp.com",
            "databaseURL": "https://knifeblackstore-1791-default-rtdb.firebaseio.com",
            "projectId": "knifeblackstore-1791",
            "storageBucket": "knifeblackstore-1791.firebasestorage.app",
            "messagingSenderId": "395101425109",
            "appId": "1:395101425109:web:905bb04ffadc1f7e38815c"
        },
        "supabase": {
            "url": "https://khkqnagkvjcxgpxisocl.supabase.co",
            "anonKey": "sb_publishable_TCaNHCwBxWyBSGKWAzs38w_hYJ7OhN5"
        }
    };

    return new Response(JSON.stringify(data), {
        status: 200,
        headers: {
            "Content-Type": "application/json"
        }
    });
}
