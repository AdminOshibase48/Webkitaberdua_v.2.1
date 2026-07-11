// Calendar functionality
let currentDate = new Date();
let currentEvents = [];

// Add event
async function addEvent(title, date, type = 'reminder') {
    try {
        const user = await getCurrentUser();
        if (!user) return null;

        const event = {
            user_id: user.id,
            title: title,
            date: date,
            type: type
        };

        const { data, error } = await supabaseClient
            .from('events')
            .insert(event)
            .select()
            .single();

        if (error) throw error;

        // Add XP for planning
        await addXP(5);

        return data;
    } catch (error) {
        console.error('Add event error:', error);
        return null;
    }
}

// Get events
async function getEvents(startDate, endDate) {
    try {
        const user = await getCurrentUser();
        if (!user) return [];

        let query = supabaseClient
            .from('events')
            .select('*')
            .eq('user_id', user.id)
            .order('date', { ascending: true });

        if (startDate) {
            query = query.gte('date', startDate);
        }
        if (endDate) {
            query = query.lte('date', endDate);
        }

        const { data, error } = await query;
        if (error) throw error;

        // Also get partner's events
        const profile = await getUserProfile();
        if (profile?.partner_id) {
            const { data: partnerEvents, error: partnerError } = await supabaseClient
                .from('events')
                .select('*')
                .eq('user_id', profile.partner_id)
                .order('date', { ascending: true });

            if (!partnerError) {
                const combined = [...data, ...partnerEvents];
                combined.sort((a, b) => new Date(a.date) - new Date(b.date));
                currentEvents = combined;
                return combined;
            }
        }

        currentEvents = data;
        return data;
    } catch (error) {
        console.error('Get events error:', error);
        return [];
    }
}

// Delete event
async function deleteEvent(eventId) {
    try {
        const { error } = await supabaseClient
            .from('events')
            .delete()
            .eq('id', eventId);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Delete event error:', error);
        return false;
    }
}

// Generate calendar
function generateCalendar(date, events) {
    const month = date.getMonth();
    const year = date.getFullYear();

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();

    // Get current month name
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    const monthName = monthNames[month];

    // Update header
    const header = document.getElementById('current-month');
    if (header) {
        header.textContent = `${monthName} ${year}`;
    }

    // Generate grid
    const grid = document.getElementById('calendar-grid');
    if (!grid) return;

    grid.innerHTML = '';

    // Day names
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayNames.forEach(day => {
        const div = document.createElement('div');
        div.className = 'calendar-day';
        div.style.fontWeight = '600';
        div.style.fontSize = '0.75rem';
        div.style.color = 'var(--text-secondary)';
        div.textContent = day;
        grid.appendChild(div);
    });

    // Empty days
    for (let i = 0; i < firstDay; i++) {
        const div = document.createElement('div');
        div.className = 'calendar-day other-month';
        grid.appendChild(div);
    }

    // Days
    const eventDates = events ? events.map(e => e.date) : [];

    for (let day = 1; day <= daysInMonth; day++) {
        const div = document.createElement('div');
        div.className = 'calendar-day';

        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isToday = dateStr === today.toISOString().split('T')[0];
        const hasEvent = eventDates.includes(dateStr);

        if (isToday) div.classList.add('today');
        if (hasEvent) div.classList.add('has-event');

        div.textContent = day;
        div.dataset.date = dateStr;

        div.addEventListener('click', () => {
            // Show events for this day
            showDayEvents(dateStr);
        });

        grid.appendChild(div);
    }
}

// Show events for a specific day
function showDayEvents(dateStr) {
    const events = currentEvents.filter(e => e.date === dateStr);
    const container = document.getElementById('events-list');
    if (!container) return;

    if (events.length === 0) {
        container.innerHTML = '<p class="empty-state">No events on this day</p>';
        return;
    }

    container.innerHTML = events.map(e => `
        <div class="event-item">
            <div>
                <span class="event-title">${e.title}</span>
                <span class="event-type">${e.type}</span>
            </div>
            <button class="delete-event-btn" data-id="${e.id}">🗑️</button>
        </div>
    `).join('');

    // Add delete handlers
    container.querySelectorAll('.delete-event-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.target.dataset.id;
            if (confirm('Delete this event?')) {
                await deleteEvent(id);
                // Refresh calendar
                const events = await getEvents();
                generateCalendar(currentDate, events);
                showDayEvents(dateStr);
                showToast('Event deleted', 'success');
            }
        });
    });
}

// Initialize calendar
document.addEventListener('DOMContentLoaded', async () => {
    // Load events
    const events = await getEvents();
    generateCalendar(currentDate, events);

    // Navigation buttons
    const prevBtn = document.getElementById('prev-month');
    const nextBtn = document.getElementById('next-month');

    if (prevBtn) {
        prevBtn.addEventListener('click', async () => {
            currentDate.setMonth(currentDate.getMonth() - 1);
            const events = await getEvents();
            generateCalendar(currentDate, events);
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', async () => {
            currentDate.setMonth(currentDate.getMonth() + 1);
            const events = await getEvents();
            generateCalendar(currentDate, events);
        });
    }

    // Add event button
    const addBtn = document.getElementById('add-event-btn');
    const modal = document.getElementById('event-modal');
    const closeModalBtn = document.getElementById('close-event-modal');

    if (addBtn) {
        addBtn.addEventListener('click', () => {
            if (modal) modal.classList.remove('hidden');
            // Set default date to today
            const dateInput = document.getElementById('event-date');
            if (dateInput) {
                dateInput.value = new Date().toISOString().split('T')[0];
            }
        });
    }

    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            if (modal) modal.classList.add('hidden');
        });
    }

    // Event form
    const eventForm = document.getElementById('event-form');
    if (eventForm) {
        eventForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const title = document.getElementById('event-title').value;
            const date = document.getElementById('event-date').value;
            const type = document.getElementById('event-type').value;

            const result = await addEvent(title, date, type);
            if (result) {
                showToast('Event added! 📅', 'success');
                modal.classList.add('hidden');
                eventForm.reset();
                // Refresh calendar
                const events = await getEvents();
                generateCalendar(currentDate, events);
            } else {
                showToast('Failed to add event', 'error');
            }
        });
    }
});

// Export functions
window.addEvent = addEvent;
window.getEvents = getEvents;
window.deleteEvent = deleteEvent;
window.generateCalendar = generateCalendar;
