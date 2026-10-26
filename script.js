const $ = (id) => document.getElementById(id);
const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
const today = new Date();
const localDate = (date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const monthOf = (date) => date.slice(0,7);
let expenses = [];
let budget = 5000;
let chart = null;
let toastTimer;

try {
  expenses = JSON.parse(localStorage.getItem('spendsmart-expenses') || '[]');
  budget = Number(localStorage.getItem('spendsmart-budget') || 5000);
} catch { expenses = []; budget = 5000; }

$('monthFilter').value = monthOf(localDate(today));
$('expenseDate').value = localDate(today);
$('year').textContent = today.getFullYear();

function save() {
  localStorage.setItem('spendsmart-expenses', JSON.stringify(expenses));
  localStorage.setItem('spendsmart-budget', String(budget));
}
function money(value) { return currency.format(value); }
function selectedExpenses() {
  const month = $('monthFilter').value;
  return expenses.filter(item => !month || monthOf(item.date) === month);
}
function showToast(message) {
  $('toast').textContent = message;
  $('toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('show'), 2300);
}
function renderSummary(items) {
  const total = items.reduce((sum, item) => sum + item.amount, 0);
  $('budgetDisplay').textContent = money(budget);
  $('totalSpent').textContent = money(total);
  $('remaining').textContent = money(budget - total);
  $('remaining').style.color = total > budget ? 'var(--red)' : 'var(--green)';
  $('transactionCount').textContent = items.length;
  $('budgetStatus').textContent = total > budget ? `Over budget by ${money(total-budget)}` : total === budget ? 'You reached your budget' : `${Math.round((total / Math.max(budget, 1)) * 100)}% of budget used`;
}
function renderTable(items) {
  const query = $('searchInput').value.trim().toLowerCase();
  const filtered = items.filter(item => `${item.title} ${item.category} ${item.payment}`.toLowerCase().includes(query))
    .sort((a,b) => b.date.localeCompare(a.date) || b.id-a.id);
  $('expenseTable').innerHTML = filtered.map(item => `
    <tr>
      <td>${escapeHTML(item.title)}</td>
      <td><span class="category-pill">${escapeHTML(item.category)}</span></td>
      <td>${new Date(`${item.date}T00:00:00`).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</td>
      <td>${escapeHTML(item.payment)}</td>
      <td class="amount-cell">${money(item.amount)}</td>
      <td><button class="delete-button" data-delete="${item.id}" aria-label="Delete ${escapeHTML(item.title)}" title="Delete expense">×</button></td>
    </tr>`).join('');
  $('emptyState').style.display = filtered.length ? 'none' : 'block';
  $('expenseTable').querySelectorAll('[data-delete]').forEach(button => button.addEventListener('click', () => {
    expenses = expenses.filter(item => item.id !== Number(button.dataset.delete));
    save(); render(); showToast('Expense deleted');
  }));
}
function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}
function renderChart(items) {
  const totals = {};
  items.forEach(item => totals[item.category] = (totals[item.category] || 0) + item.amount);
  const labels = Object.keys(totals);
  $('chartEmpty').style.display = labels.length ? 'none' : 'block';
  $('expenseChart').parentElement.classList.toggle('has-data', labels.length > 0);
  if (chart) chart.destroy();
  if (!window.Chart) return;
  chart = new Chart($('expenseChart'), {
    type: 'doughnut',
    data: { labels, datasets: [{ data: labels.map(label => totals[label]), backgroundColor: ['#655bea','#39b7a1','#f2ad3d','#f07991','#64a5f4','#a78bfa','#8b9bad'], borderWidth: 0, hoverOffset: 5 }] },
    options: { responsive: true, maintainAspectRatio: false, cutout: '68%', plugins: { legend: { position: 'right', labels: { boxWidth: 10, boxHeight: 10, padding: 14, color: getComputedStyle(document.body).getPropertyValue('--text').trim(), font: { size: 11 } } }, tooltip: { callbacks: { label: context => `${context.label}: ${money(context.raw)}` } } } }
  });
}
function renderInsights(items) {
  const total = items.reduce((sum,item)=>sum+item.amount,0);
  const byCategory = {};
  items.forEach(item => byCategory[item.category] = (byCategory[item.category] || 0) + item.amount);
  const insights = [];
  if (!items.length) {
    insights.push(['💡','Add a few expenses to receive useful saving tips.']);
  } else {
    const top = Object.entries(byCategory).sort((a,b)=>b[1]-a[1])[0];
    if (top) {
      const share = Math.round(top[1] / total * 100);
      insights.push(['📊',`${top[0]} is your largest category at ${share}% of recorded spending.`]);
    }
    const remaining = budget-total;
    insights.push([remaining < 0 ? '⚠️' : '🎯',remaining < 0 ? `You are ${money(Math.abs(remaining))} over budget. Review optional purchases.` : `You have ${money(remaining)} left in your monthly budget.`]);
    const food = byCategory.Food || 0;
    if (food > 0) insights.push(['🥗',`Food spending is ${money(food)}. Planning meals may help reduce costs.`]);
    else insights.push(['📝','Record expenses regularly to get a clearer picture of your habits.']);
  }
  $('insights').innerHTML = insights.slice(0,3).map(([icon,text])=>`<div class="insight"><span>${icon}</span><p>${escapeHTML(text)}</p></div>`).join('');
}
function render() {
  const items = selectedExpenses();
  renderSummary(items); renderTable(items); renderChart(items); renderInsights(items);
}
$('expenseForm').addEventListener('submit', event => {
  event.preventDefault();
  const title = $('expenseTitle').value.trim();
  const amount = Number($('expenseAmount').value);
  const date = $('expenseDate').value;
  if (!title || !Number.isFinite(amount) || amount <= 0 || !date) { showToast('Please enter valid expense details'); return; }
  expenses.push({ id: Date.now(), title, amount, date, category: $('expenseCategory').value, payment: $('expensePayment').value });
  save(); $('expenseForm').reset(); $('expenseDate').value = localDate(today);
  render(); showToast('Expense added successfully');
});
$('monthFilter').addEventListener('change', render);
$('searchInput').addEventListener('input', () => renderTable(selectedExpenses()));
$('editBudgetBtn').addEventListener('click', () => {
  const value = prompt('Enter your monthly budget in rupees:', String(budget));
  if (value === null) return;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) { showToast('Please enter a budget greater than zero'); return; }
  budget = parsed; save(); render(); showToast('Monthly budget updated');
});
$('themeToggle').addEventListener('click', () => {
  document.body.classList.toggle('dark');
  $('themeToggle').textContent = document.body.classList.contains('dark') ? '☀' : '☾';
  renderChart(selectedExpenses());
});
render();
