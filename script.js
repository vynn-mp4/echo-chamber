document.getElementById('suggestionForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const message = document.getElementById('message').value.trim();

  if (!message) return;

  try {
    const res = await fetch('https://echo-chamber-backend.onrender.com/api/suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });

    if (res.ok) {
      alert('✅ Thank you! Your suggestion was sent anonymously.');
      document.getElementById('message').value = '';
    } else {
      const data = await res.json();
      alert(`❌ ${data.error}`);
    }
  } catch (err) {
    alert('❌ Could not send. Is the server running?');
  }
});