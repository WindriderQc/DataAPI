document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('form');
  const password = document.getElementById('password');
  const confirmPassword = document.getElementById('confirmPassword');
  const passwordError = document.getElementById('passwordError');
  const submitBtn = document.getElementById('submitBtn');

  if (!form || !password || !confirmPassword || !passwordError || !submitBtn) return;

  function validatePasswords() {
    if (password.value && confirmPassword.value) {
      if (password.value !== confirmPassword.value) {
        passwordError.style.display = 'block';
        submitBtn.disabled = true;
        return false;
      }

      passwordError.style.display = 'none';
      submitBtn.disabled = false;
      return true;
    }

    passwordError.style.display = 'none';
    submitBtn.disabled = false;
    return true;
  }

  password.addEventListener('input', validatePasswords);
  confirmPassword.addEventListener('input', validatePasswords);

  form.addEventListener('submit', (e) => {
    if (!validatePasswords()) e.preventDefault();
  });
});
