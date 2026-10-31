import type { Account, FinanceData, Stock, StockTrade, UserPreferences } from './types'

let activePreferences: UserPreferences = { currency: 'BDT', timezone: 'Asia/Dhaka' }
export const setFinancePreferences = (prefs?: Partial<UserPreferences>) => { activePreferences = { ...activePreferences, ...prefs } }
export const todayISO = () => new Intl.DateTimeFormat('en-CA', { timeZone: activePreferences.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
export const uid = () => crypto.randomUUID()
export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
export const money = (n: number) => { const value = Number.isFinite(n) ? n : 0; if (activePreferences.currency === 'BDT') return `৳${value.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`; try { return new Intl.NumberFormat('en', { style: 'currency', currency: activePreferences.currency, maximumFractionDigits: 2 }).format(value) } catch { return `${activePreferences.currency} ${value.toLocaleString('en', { maximumFractionDigits: 2 })}` } }
export const monthKey = (date: string) => date.slice(0, 7)
export const dateInRange = (date: string, start: string, end: string) => date >= start && date <= end
export const startOfWeek = (date: Date) => { const d = new Date(date); const weekday = d.getDay(); d.setDate(d.getDate() - weekday); d.setHours(0,0,0,0); return d }
export const isoLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`

export function accountBalances(data: FinanceData): Record<string, number> {
  const balances: Record<string, number> = {}
  data.accounts.forEach(a => balances[a.id] = round2(a.openingBalance))
  data.transactions.forEach(t => {
    if (t.kind === 'income') balances[t.accountId] = round2((balances[t.accountId] ?? 0) + t.amount)
    if (t.kind === 'expense') balances[t.accountId] = round2((balances[t.accountId] ?? 0) - t.amount)
    if (t.kind === 'transfer') {
      balances[t.accountId] = round2((balances[t.accountId] ?? 0) - t.amount)
      if (t.toAccountId) balances[t.toAccountId] = round2((balances[t.toAccountId] ?? 0) + t.amount)
    }
  })
  data.stockTrades.forEach(t => {
    const gross = round2(t.quantity * t.price)
    const fee = round2(gross * t.feePct / 100 + t.fixedFee)
    balances[t.accountId] = round2((balances[t.accountId] ?? 0) + (t.side === 'buy' ? -(gross + fee) : gross - fee))
  })
  data.dividends.forEach(d => { balances[d.accountId] = round2((balances[d.accountId] ?? 0) + d.amount) })
  data.investments.forEach(i => { balances[i.accountId] = round2((balances[i.accountId] ?? 0) - i.invested - Number(i.fees || 0)) })
  ;(data.investmentEvents || []).forEach(ev => { const fee = Number(ev.fee || 0); if (ev.kind === 'contribute' && ev.accountId) balances[ev.accountId] = round2((balances[ev.accountId] ?? 0) - ev.amount - fee); if (ev.kind === 'withdraw' && ev.accountId) balances[ev.accountId] = round2((balances[ev.accountId] ?? 0) + ev.amount - fee); if (ev.kind === 'dividend' && ev.accountId) balances[ev.accountId] = round2((balances[ev.accountId] ?? 0) + ev.amount - fee) })
  return balances
}
export function stockPositions(stocks: Stock[], trades: StockTrade[]) {
  return stocks.map(stock => {
    const relevant = trades.filter(t => t.stockId === stock.id).sort((a,b) => a.date.localeCompare(b.date))
    const lots: { qty: number; unitCost: number; date: string }[] = []
    let realized = 0
    let buyFees = 0
    let sellFees = 0
    for (const t of relevant) {
      const gross = round2(t.quantity * t.price)
      const fee = round2(gross * t.feePct / 100 + t.fixedFee)
      if (t.side === 'buy') {
        buyFees += fee
        lots.push({ qty: t.quantity, unitCost: (gross + fee) / t.quantity, date: t.date })
      } else {
        sellFees += fee
        let remaining = t.quantity
        let cost = 0
        while (remaining > 0.0000001 && lots.length) {
          const lot = lots[0]
          const used = Math.min(remaining, lot.qty)
          cost += used * lot.unitCost
          lot.qty -= used
          remaining -= used
          if (lot.qty <= 0.0000001) lots.shift()
        }
        realized = round2(realized + gross - fee - cost)
      }
    }
    const shares = lots.reduce((s,l) => s + l.qty, 0)
    const costBasis = round2(lots.reduce((s,l) => s + l.qty*l.unitCost, 0))
    const currentValue = round2(shares * stock.currentPrice)
    const earliest = lots.map(l => l.date).sort()[0]
    const unrealized = round2(currentValue - costBasis)
    return { stock, shares, costBasis, averageCost: shares ? costBasis/shares : 0, currentValue, realized, unrealized, totalReturn: realized + unrealized, buyFees, sellFees, earliest }
  })
}
export function investmentCostBasis(data: FinanceData, investmentId: string) {
  const holding = data.investments.find(i => i.id === investmentId)
  const base = (holding?.invested || 0) + Number(holding?.fees || 0)
  return round2(base + (data.investmentEvents || []).filter(e => e.investmentId === investmentId).reduce((sum,e) => sum + (e.kind === 'contribute' ? e.amount + Number(e.fee || 0) : e.kind === 'withdraw' ? -Number(e.costBasisRemoved || 0) : 0), 0))
}
export function getTotals(data: FinanceData) {
  const balances = accountBalances(data)
  const accountTotal = round2(Object.values(balances).reduce((a,b)=>a+b,0))
  const savings = round2(data.goals.reduce((s,g)=>s+g.allocated,0))
  const positions = stockPositions(data.stocks, data.stockTrades)
  const stockValue = round2(positions.reduce((s,p)=>s+p.currentValue,0))
  const otherValue = round2(data.investments.reduce((s,i)=>s+i.currentValue,0))
  const expenses = data.transactions.filter(t=>t.kind==='expense')
  const incomes = data.transactions.filter(t=>t.kind==='income')
  const investedCapital = round2(positions.reduce((s,p)=>s+p.costBasis,0) + data.investments.reduce((s,i)=>s+investmentCostBasis(data,i.id),0))
  const dividendTotal = round2(data.dividends.reduce((s,d)=>s+d.amount,0))
  return { balances, accountTotal, savings, available: accountTotal-savings, stockValue, otherValue, investmentValue: stockValue+otherValue, netWorth: accountTotal+stockValue+otherValue, expenses, incomes, investedCapital, dividendTotal, positions }
}
export function monthBounds(date = todayISO()) { const [y,m] = date.split('-').map(Number); return { start: `${y}-${String(m).padStart(2,'0')}-01`, end: isoLocal(new Date(y, m, 0)) } }
export function rangeTotals(data: FinanceData, start: string, end: string) {
  const ts = data.transactions.filter(t=>dateInRange(t.date,start,end))
  return { income: ts.filter(t=>t.kind==='income').reduce((s,t)=>s+t.amount,0), expense: ts.filter(t=>t.kind==='expense').reduce((s,t)=>s+t.amount,0), count: ts.length }
}
export function durationSince(date?: string) {
  if (!date) return '—'
  const from = new Date(`${date}T00:00:00`), to = new Date(`${todayISO()}T00:00:00`)
  let months = (to.getFullYear()-from.getFullYear())*12 + to.getMonth()-from.getMonth()
  if (to.getDate()<from.getDate()) months--
  months = Math.max(0,months)
  const years = Math.floor(months/12), rem = months%12
  if (years===0 && rem===0) return 'Less than a month'
  return [years ? `${years}y` : '', rem ? `${rem}m` : ''].filter(Boolean).join(' ')
}
