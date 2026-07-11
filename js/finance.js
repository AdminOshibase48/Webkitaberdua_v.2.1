// Finance functionality
let currentTransactions = [];
let currentBudgets = [];
let currentSavings = [];

// Add transaction
async function addTransaction(type, amount, category, description = '') {
    try {
        const user = await getCurrentUser();
        if (!user) return null;

        const transaction = {
            user_id: user.id,
            type: type,
            amount: parseFloat(amount),
            category: category,
            description: description,
            date: new Date().toISOString()
        };

        const { data, error } = await supabaseClient
            .from('transactions')
            .insert(transaction)
            .select()
            .single();

        if (error) throw error;

        // Add XP for financial responsibility
        await addXP(3);

        return data;
    } catch (error) {
        console.error('Add transaction error:', error);
        return null;
    }
}

// Get transactions
async function getTransactions(limit = 50) {
    try {
        const user = await getCurrentUser();
        if (!user) return [];

        const { data, error } = await supabaseClient
            .from('transactions')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        currentTransactions = data;
        return data;
    } catch (error) {
        console.error('Get transactions error:', error);
        return [];
    }
}

// Get shared transactions (both partners)
async function getSharedTransactions(limit = 50) {
    try {
        const user = await getCurrentUser();
        if (!user) return [];

        const profile = await getUserProfile();
        if (!profile || !profile.partner_id) {
            return await getTransactions(limit);
        }

        const { data, error } = await supabaseClient
            .from('transactions')
            .select('*')
            .or(`user_id.eq.${user.id},user_id.eq.${profile.partner_id}`)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Get shared transactions error:', error);
        return [];
    }
}

// Calculate totals
async function calculateTotals() {
    try {
        const transactions = await getSharedTransactions(1000);
        let totalIncome = 0;
        let totalExpense = 0;
        let totalSavings = 0;

        transactions.forEach(t => {
            if (t.type === 'income') totalIncome += parseFloat(t.amount);
            else if (t.type === 'expense') totalExpense += parseFloat(t.amount);
            else if (t.type === 'savings') totalSavings += parseFloat(t.amount);
        });

        return {
            totalIncome,
            totalExpense,
            totalSavings,
            balance: totalIncome - totalExpense - totalSavings,
            transactions
        };
    } catch (error) {
        console.error('Calculate totals error:', error);
        return {
            totalIncome: 0,
            totalExpense: 0,
            totalSavings: 0,
            balance: 0,
            transactions: []
        };
    }
}

// Add budget
async function addBudget(category, amount, period = 'monthly') {
    try {
        const user = await getCurrentUser();
        if (!user) return null;

        const budget = {
            user_id: user.id,
            category: category,
            amount: parseFloat(amount),
            period: period,
            spent: 0,
            start_date: new Date().toISOString()
        };

        const { data, error } = await supabaseClient
            .from('budgets')
            .insert(budget)
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Add budget error:', error);
        return null;
    }
}

// Get budgets
async function getBudgets() {
    try {
        const user = await getCurrentUser();
        if (!user) return [];

        const { data, error } = await supabaseClient
            .from('budgets')
            .select('*')
            .eq('user_id', user.id);

        if (error) throw error;
        currentBudgets = data;
        return data;
    } catch (error) {
        console.error('Get budgets error:', error);
        return [];
    }
}

// Add savings goal
async function addSavingsGoal(name, targetAmount, currentAmount = 0) {
    try {
        const user = await getCurrentUser();
        if (!user) return null;

        const savings = {
            user_id: user.id,
            name: name,
            target_amount: parseFloat(targetAmount),
            current_amount: parseFloat(currentAmount)
        };

        const { data, error } = await supabaseClient
            .from('savings_goals')
            .insert(savings)
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Add savings goal error:', error);
        return null;
    }
}

// Render transactions
function renderTransactions(transactions) {
    const container = document.getElementById('transactions-list');
    if (!container) return;

    if (!transactions || transactions.length === 0) {
        container.innerHTML = '<p class="empty-state">No transactions yet</p>';
        return;
    }

    container.innerHTML = transactions.slice(0, 10).map(t => {
        const isIncome = t.type === 'income';
        const amountClass = isIncome ? 'income' : 'expense';
        const sign = isIncome ? '+' : '-';

        return `
            <div class="transaction-item">
                <div class="transaction-info">
                    <span>${t.description || t.category}</span>
                    <span class="transaction-category">${t.category}</span>
                </div>
                <span class="transaction-amount ${amountClass}">
                    ${sign} Rp ${parseFloat(t.amount).toLocaleString()}
                </span>
            </div>
        `;
    }).join('');
}

// Initialize finance
document.addEventListener('DOMContentLoaded', async () => {
    // Load transactions
    const totals = await calculateTotals();

    // Update summary cards
    const balanceEl = document.getElementById('total-balance');
    const incomeEl = document.getElementById('total-income');
    const expenseEl = document.getElementById('total-expense');
    const savingsEl = document.getElementById('total-savings');

    if (balanceEl) balanceEl.textContent = `Rp ${totals.balance.toLocaleString()}`;
    if (incomeEl) incomeEl.textContent = `Rp ${totals.totalIncome.toLocaleString()}`;
    if (expenseEl) expenseEl.textContent = `Rp ${totals.totalExpense.toLocaleString()}`;
    if (savingsEl) savingsEl.textContent = `Rp ${totals.totalSavings.toLocaleString()}`;

    renderTransactions(totals.transactions);

    // Transaction form handlers
    const modal = document.getElementById('transaction-modal');
    const addIncomeBtn = document.getElementById('add-income');
    const addExpenseBtn = document.getElementById('add-expense');
    const addSavingsBtn = document.getElementById('add-savings');
    const closeModalBtn = document.getElementById('close-modal');

    const showModal = (type) => {
        if (!modal) return;
        document.getElementById('transaction-type').value = type;
        document.getElementById('transaction-modal-title').textContent =
            type === 'income' ? 'Add Income' :
            type === 'expense' ? 'Add Expense' : 'Add Savings';
        modal.classList.remove('hidden');
    };

    if (addIncomeBtn) addIncomeBtn.addEventListener('click', () => showModal('income'));
    if (addExpenseBtn) addExpenseBtn.addEventListener('click', () => showModal('expense'));
    if (addSavingsBtn) addSavingsBtn.addEventListener('click', () => showModal('savings'));

    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            modal.classList.add('hidden');
        });
    }

    const transactionForm = document.getElementById('transaction-form');
    if (transactionForm) {
        transactionForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const type = document.getElementById('transaction-type').value;
            const amount = document.getElementById('transaction-amount').value;
            const category = document.getElementById('transaction-category').value || 'General';
            const description = document.getElementById('transaction-description').value || '';

            const result = await addTransaction(type, amount, category, description);
            if (result) {
                showToast('Transaction added successfully! 💰', 'success');
                modal.classList.add('hidden');
                transactionForm.reset();
                // Reload transactions
                const newTotals = await calculateTotals();
                renderTransactions(newTotals.transactions);
                // Update summary
                if (balanceEl) balanceEl.textContent = `Rp ${newTotals.balance.toLocaleString()}`;
                if (incomeEl) incomeEl.textContent = `Rp ${newTotals.totalIncome.toLocaleString()}`;
                if (expenseEl) expenseEl.textContent = `Rp ${newTotals.totalExpense.toLocaleString()}`;
                if (savingsEl) savingsEl.textContent = `Rp ${newTotals.totalSavings.toLocaleString()}`;
            } else {
                showToast('Failed to add transaction', 'error');
            }
        });
    }
});

// Export functions
window.addTransaction = addTransaction;
window.getTransactions = getTransactions;
window.getSharedTransactions = getSharedTransactions;
window.calculateTotals = calculateTotals;
window.addBudget = addBudget;
window.getBudgets = getBudgets;
window.addSavingsGoal = addSavingsGoal;
