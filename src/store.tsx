import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js'
import type { BlogPost, FinanceData } from './types'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const SUPABASE_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined
export const supabase: SupabaseClient | null = SUPABASE_URL && SUPABASE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true } })
  : null

export const emptyData: FinanceData = { accounts: [], categories: [], transactions: [], goals: [], savingsEvents: [], investments: [], investmentEvents: [], stocks: [], stockTrades: [], dividends: [], blogs: [], preferences: { currency: 'BDT', timezone: 'Asia/Dhaka' } }
type StoreValue = {
  data: FinanceData; setData: React.Dispatch<React.SetStateAction<FinanceData>>
  session: Session | null; authLoading: boolean; cloudEnabled: boolean; isAdmin: boolean; passwordRecovery: boolean
  signIn: (email: string, password: string) => Promise<string | null>
  signUp: (email: string, password: string) => Promise<string | null>
  resetPassword: (email: string) => Promise<string | null>; updatePassword: (password: string) => Promise<string | null>
  signOut: () => Promise<void>; saveBlog: (post: BlogPost) => Promise<string | null>; deleteBlog: (id: string) => Promise<string | null>; uploadBlogCover: (file: File) => Promise<{ url: string | null; error: string | null }>
}
const StoreContext = createContext<StoreValue | null>(null)
const storageKey = (userId?: string) => `tyrion-v1-${userId || 'demo'}`
function readLocal(userId?: string): FinanceData {
  try { const currentKey = storageKey(userId); const legacyKey = `moneyglass-v1-${userId || 'demo'}`; const raw = localStorage.getItem(currentKey) || localStorage.getItem(legacyKey); if (!raw) return emptyData; const parsed = JSON.parse(raw); return { ...emptyData, ...parsed, preferences: { ...emptyData.preferences, ...(parsed.preferences || {}) }, investmentEvents: parsed.investmentEvents || [], accounts: parsed.accounts || [], categories: parsed.categories || [], transactions: parsed.transactions || [], goals: parsed.goals || [], savingsEvents: parsed.savingsEvents || [], investments: parsed.investments || [], stocks: parsed.stocks || [], stockTrades: parsed.stockTrades || [], dividends: parsed.dividends || [], blogs: parsed.blogs || [] } } catch { return emptyData }
}
function blogFromRow(row: any): BlogPost {
  return { id: row.id, title: row.title, slug: row.slug, excerpt: row.excerpt || '', content: row.content || '', category: row.category || 'General', coverUrl: row.cover_url || '', status: row.status, publishedAt: row.published_at || undefined, updatedAt: row.updated_at }
}
export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<FinanceData>(() => readLocal())
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(Boolean(supabase))
  const [loaded, setLoaded] = useState(!supabase)
  const [isAdmin, setIsAdmin] = useState(false)
  const [passwordRecovery, setPasswordRecovery] = useState(false)

  useEffect(() => {
    if (!supabase) return
    let alive = true
    supabase.auth.getSession().then(({ data: { session: s } }) => { if (alive) setSession(s) })
    const { data: listener } = supabase.auth.onAuthStateChange((event, s) => { setSession(s); if (event === 'SIGNED_OUT' || !s) { setLoaded(true); setAuthLoading(false) } else if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'USER_UPDATED') { setLoaded(false); setAuthLoading(true) } setPasswordRecovery(event === 'PASSWORD_RECOVERY') })
    return () => { alive = false; listener.subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    if (!supabase) return
    let alive = true
    const load = async () => {
      if (!session?.user) {
        const { data: publicPosts } = await supabase!.from('blog_posts').select('*').eq('status', 'published').order('published_at', { ascending: false })
        if (!alive) return
        setData({ ...emptyData, ...readLocal(), blogs: (publicPosts || []).map(blogFromRow) })
        setIsAdmin(false); setLoaded(true); setAuthLoading(false); return
      }
      setAuthLoading(true); setLoaded(false)
      const [{ data: stateRow, error: stateError }, { data: posts }, { data: profile }] = await Promise.all([
        supabase!.from('finance_state').select('data').eq('user_id', session.user.id).maybeSingle(),
        supabase!.from('blog_posts').select('*').order('updated_at', { ascending: false }),
        supabase!.from('profiles').select('role').eq('id', session.user.id).maybeSingle()
      ])
      if (!alive) return
      const rawBase = stateError || !stateRow?.data ? readLocal(session.user.id) : stateRow.data
      const base = { ...emptyData, ...rawBase, preferences: { ...emptyData.preferences, ...(rawBase.preferences || {}) }, investmentEvents: rawBase.investmentEvents || [], accounts: rawBase.accounts || [], categories: rawBase.categories || [], transactions: rawBase.transactions || [], goals: rawBase.goals || [], savingsEvents: rawBase.savingsEvents || [], investments: rawBase.investments || [], stocks: rawBase.stocks || [], stockTrades: rawBase.stockTrades || [], dividends: rawBase.dividends || [] }
      setData({ ...base, blogs: (posts || []).map(blogFromRow) })
      setIsAdmin(profile?.role === 'admin')
      setLoaded(true); setAuthLoading(false)
    }
    load()
    return () => { alive = false }
  }, [session?.user?.id])

  useEffect(() => {
    if (!loaded) return
    const key = storageKey(session?.user?.id)
    const localCopy = { ...data }
    localStorage.setItem(key, JSON.stringify(localCopy))
    if (!supabase || !session?.user) return
    const timer = window.setTimeout(() => {
      const { blogs: _blogs, ...financeOnly } = data
      supabase!.from('finance_state').upsert({ user_id: session.user.id, data: financeOnly, updated_at: new Date().toISOString() }, { onConflict: 'user_id' }).then(({ error }) => {
        if (error) console.error('Cloud sync failed:', error.message)
      })
    }, 650)
    return () => window.clearTimeout(timer)
  }, [data, loaded, session?.user?.id])

  const signIn = async (email: string, password: string) => {
    if (!supabase) return 'Cloud authentication is not configured. Add your Supabase URL and publishable key to the GitHub Actions secrets.'
    const { error } = await supabase.auth.signInWithPassword({ email, password }); return error?.message || null
  }
  const signUp = async (email: string, password: string) => {
    if (!supabase) return 'Cloud authentication is not configured.'
    const { error } = await supabase.auth.signUp({ email, password }); return error?.message || null
  }
  const resetPassword = async (email: string) => { if (!supabase) return 'Cloud authentication is not configured.'; const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.href.split('#')[0] }); return error?.message || null }
  const updatePassword = async (password: string) => { if (!supabase) return 'Cloud authentication is not configured.'; const { error } = await supabase.auth.updateUser({ password }); if (!error) setPasswordRecovery(false); return error?.message || null }
  const signOut = async () => { if (supabase) await supabase.auth.signOut(); setSession(null); setPasswordRecovery(false); setData(readLocal()) }
  const saveBlog = async (post: BlogPost) => {
    if (!supabase) return 'Blog publishing is available only to the configured administrator account.'
    if (!session?.user || !isAdmin) return 'Only an authenticated administrator can publish blog posts.'
    const row = { id: post.id, author_id: session.user.id, title: post.title, slug: post.slug, excerpt: post.excerpt, content: post.content, category: post.category, cover_url: post.coverUrl || null, status: post.status, published_at: post.status === 'published' ? (post.publishedAt || new Date().toISOString()) : null, updated_at: new Date().toISOString() }
    const { error } = await supabase.from('blog_posts').upsert(row)
    if (!error) setData(d => ({ ...d, blogs: [post, ...d.blogs.filter(p => p.id !== post.id)] }))
    return error?.message || null
  }
  const uploadBlogCover = async (file: File) => {
    if (!supabase || !session?.user || !isAdmin) return { url: null, error: 'Only the configured administrator can upload blog images.' }
    if (!file.type.startsWith('image/')) return { url: null, error: 'Choose an image file.' }
    if (file.size > 5 * 1024 * 1024) return { url: null, error: 'Image must be 5 MB or smaller.' }
    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${session.user.id}/${crypto.randomUUID()}.${extension}`
    const { error } = await supabase.storage.from('blog-covers').upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type })
    if (error) return { url: null, error: error.message }
    const { data: publicFile } = supabase.storage.from('blog-covers').getPublicUrl(path)
    return { url: publicFile.publicUrl, error: null }
  }
  const deleteBlog = async (id: string) => {
    if (!supabase) return 'Blog management is available only to the configured administrator account.'
    if (!session?.user || !isAdmin) return 'Only an authenticated administrator can delete blog posts.'
    const { error } = await supabase.from('blog_posts').delete().eq('id', id)
    if (!error) setData(d => ({ ...d, blogs: d.blogs.filter(p => p.id !== id) }))
    return error?.message || null
  }
  const value = useMemo(() => ({ data, setData, session, authLoading, cloudEnabled: !!supabase, isAdmin, passwordRecovery, signIn, signUp, resetPassword, updatePassword, signOut, saveBlog, deleteBlog, uploadBlogCover }), [data, session, authLoading, isAdmin, passwordRecovery])
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}
export function useFinance() { const value = useContext(StoreContext); if (!value) throw new Error('useFinance must be used within FinanceProvider'); return value }
