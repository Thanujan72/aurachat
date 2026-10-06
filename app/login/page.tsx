'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false) // Toggle between Login and Signup
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (isSignUp) {
        // --- SIGN UP ---
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        })
        if (error) throw error

        // Sync Database-la save panna
        if (data.user) {
          await fetch('/api/auth/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }, // <-- ITHU THAAN MISS AACHU!
            body: JSON.stringify({ id: data.user.id, email: data.user.email }),
          })
        }
        
        alert('Registration successful! You can now log in.')
        setIsSignUp(false)

      } else {
        // --- LOG IN ---
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error

        // Sync Database-la save panna
        if (data.user) {
          await fetch('/api/auth/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }, // <-- ITHU THAAN MISS AACHU!
            body: JSON.stringify({ id: data.user.id, email: data.user.email }),
          })
        }

        router.push('/chat') 
      }
    } catch (error: any) {
      alert(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#111b21] text-white">
      <div className="w-full max-w-md p-8 bg-[#202c33] rounded-xl shadow-2xl">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-[#00a884]">AuraChat</h1>
          <p className="text-gray-400 text-sm mt-1">
            {isSignUp ? 'Create a new account' : 'Log in to your account'}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-300">Email Address</label>
            <input 
              type="email" 
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 rounded bg-[#2a3942] border border-gray-600 focus:outline-none focus:border-[#00a884]"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-gray-300">Password</label>
            <input 
              type="password" 
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 rounded bg-[#2a3942] border border-gray-600 focus:outline-none focus:border-[#00a884]"
              required
            />
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#00a884] text-white font-semibold rounded-lg hover:bg-[#008f72] transition disabled:opacity-50"
          >
            {loading ? 'Processing...' : isSignUp ? 'Sign Up' : 'Log In'}
          </button>
        </form>

        <div className="text-center mt-6">
          <button 
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-sm text-[#00a884] hover:underline focus:outline-none"
          >
            {isSignUp ? 'Already have an account? Log In' : "Don't have an account? Sign Up"}
          </button>
        </div>
      </div>
    </div>
  )
}