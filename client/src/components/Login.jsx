import React from 'react';
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth } from "../firebase";

export default function Login({ onLogin }) {
    const handleLogin = async () => {
        const provider = new GoogleAuthProvider();
        try {
            const result = await signInWithPopup(auth, provider);
            onLogin(result.user);
        } catch (error) {
            console.error("Login failed:", error);
            // alert("Login failed. Check console for details. Make sure Firebase is configured.");
            // Dev bypass for testing without config
            if (error.code === 'auth/configuration-not-found' || error.code === 'auth/invalid-api-key') {
                const devUser = { displayName: "Dev User", email: "dev@example.com", photoURL: "https://via.placeholder.com/150" };
                onLogin(devUser);
            }
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen">
            <div className="bg-slate-800 p-8 rounded-xl shadow-2xl text-center max-w-md w-full">
                <h2 className="text-3xl font-bold mb-6 text-white">Welcome back</h2>
                <p className="text-slate-400 mb-8">Sign in to play Chess with friends</p>
                <button
                    onClick={handleLogin}
                    className="flex items-center justify-center gap-3 w-full bg-white text-slate-900 font-bold py-3 px-6 rounded-lg hover:bg-slate-200 transition-all border-none"
                >
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" />
                    Sign in with Google
                </button>

                <div className="relative flex py-4 items-center">
                    <div className="flex-grow border-t border-slate-600"></div>
                    <span className="flex-shrink mx-4 text-slate-400">Or</span>
                    <div className="flex-grow border-t border-slate-600"></div>
                </div>

                <button
                    onClick={() => onLogin({ displayName: "Guest Player", photoURL: "", uid: "guest-" + Date.now() })}
                    className="w-full bg-slate-700 text-white font-bold py-3 px-6 rounded-lg hover:bg-slate-600 transition-all border-none"
                >
                    Play as Guest
                </button>
            </div>
        </div>
    );
}
