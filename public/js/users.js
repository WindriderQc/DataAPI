document.addEventListener('DOMContentLoaded', () => {
  // Password validation helpers
  function validatePasswordMatch(password, confirmPassword, errorElementId, submitButton) {
    const errorEl = document.getElementById(errorElementId);
    if (!errorEl) return true;

    if (password && confirmPassword) {
      if (password !== confirmPassword) {
        errorEl.style.display = 'block';
        if (submitButton) submitButton.disabled = true;
        return false;
      }

      errorEl.style.display = 'none';
      if (submitButton) submitButton.disabled = false;
      return true;
    }

    errorEl.style.display = 'none';
    if (submitButton) submitButton.disabled = false;
    return true;
  }

  // ===== Create user =====
  const createUserForm = document.getElementById('createUserForm');
  const createPassword = document.getElementById('password');
  const createConfirmPassword = document.getElementById('confirmPassword');
  const createConfirmPasswordGroup = document.getElementById('createConfirmPasswordGroup');
  const createSubmitBtn = document.querySelector('#createUserForm button[type="submit"]');

  if (createPassword && createConfirmPasswordGroup) {
    createPassword.addEventListener('focus', () => {
      createConfirmPasswordGroup.style.display = 'block';
    });

    createPassword.addEventListener('input', () => {
      if (!createConfirmPassword) return;

      if (createPassword.value) {
        createConfirmPasswordGroup.style.display = 'block';
        validatePasswordMatch(createPassword.value, createConfirmPassword.value, 'createPasswordError', createSubmitBtn);
      } else {
        createConfirmPasswordGroup.style.display = 'none';
        createConfirmPassword.value = '';
        const err = document.getElementById('createPasswordError');
        if (err) err.style.display = 'none';
        if (createSubmitBtn) createSubmitBtn.disabled = false;
      }
    });
  }

  if (createConfirmPassword && createPassword) {
    createConfirmPassword.addEventListener('input', () => {
      validatePasswordMatch(createPassword.value, createConfirmPassword.value, 'createPasswordError', createSubmitBtn);
    });
  }

  if (createUserForm) {
    createUserForm.addEventListener('submit', async (event) => {
      event.preventDefault();

      if (createPassword && createConfirmPassword) {
        if (!validatePasswordMatch(createPassword.value, createConfirmPassword.value, 'createPasswordError', createSubmitBtn)) return;
      }

      const formData = new FormData(createUserForm);
      const data = Object.fromEntries(formData.entries());

      try {
        const response = await fetch('/api/v1/users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(data)
        });

        if (response.ok) {
          location.reload();
        } else {
          const error = await response.json();
          alert(`Error: ${error.message}`);
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error creating user:', error);
        alert('An error occurred while creating the user.');
      }
    });
  }

  // ===== Update user (dropdown -> update form) =====
  const loadUserBtn = document.getElementById('loadUserBtn');
  const cancelEditBtn = document.getElementById('cancelEditBtn');
  const userSelectDropdown = document.getElementById('userSelectDropdown');
  const updateUserForm = document.getElementById('updateUserForm');

  if (loadUserBtn) {
    loadUserBtn.addEventListener('click', () => {
      const select = userSelectDropdown;
      if (!select) return;

      const option = select.options[select.selectedIndex];
      if (!option || !option.value) {
        alert('Please select a user');
        return;
      }

      const userRaw = option.getAttribute('data-user');
      if (!userRaw) return;

      const user = JSON.parse(userRaw);

      const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
      };

      setVal('updateUserId', user._id);
      setVal('updateName', user.name);
      setVal('updateEmail', user.email);
      setVal('updateLat', user.lat || '');
      setVal('updateLon', user.lon || '');
      setVal('updateProfile', user.profileId || '');
      setVal('updateCreationDate', user.creationDate ? new Date(user.creationDate).toLocaleString() : '');
      setVal('updateLastConnect', user.lastConnectDate ? new Date(user.lastConnectDate).toLocaleString() : '');
      setVal('updatePassword', '');
      setVal('updateConfirmPassword', '');

      const group = document.getElementById('updateConfirmPasswordGroup');
      if (group) group.style.display = 'none';

      if (updateUserForm) updateUserForm.style.display = 'block';
    });
  }

  if (cancelEditBtn) {
    cancelEditBtn.addEventListener('click', () => {
      if (updateUserForm) updateUserForm.style.display = 'none';
      if (userSelectDropdown) userSelectDropdown.value = '';
    });
  }

  const updatePassword = document.getElementById('updatePassword');
  const updateConfirmPassword = document.getElementById('updateConfirmPassword');
  const updateConfirmPasswordGroup = document.getElementById('updateConfirmPasswordGroup');
  const updateSubmitBtn = document.querySelector('#updateUserForm button[type="submit"]');

  if (updatePassword && updateConfirmPasswordGroup) {
    updatePassword.addEventListener('focus', () => {
      updateConfirmPasswordGroup.style.display = 'block';
    });

    updatePassword.addEventListener('input', () => {
      if (!updateConfirmPassword) return;

      if (updatePassword.value) {
        updateConfirmPasswordGroup.style.display = 'block';
        validatePasswordMatch(updatePassword.value, updateConfirmPassword.value, 'updatePasswordError', updateSubmitBtn);
      } else {
        updateConfirmPasswordGroup.style.display = 'none';
        updateConfirmPassword.value = '';
        const err = document.getElementById('updatePasswordError');
        if (err) err.style.display = 'none';
        if (updateSubmitBtn) updateSubmitBtn.disabled = false;
      }
    });
  }

  if (updateConfirmPassword && updatePassword) {
    updateConfirmPassword.addEventListener('input', () => {
      if (!updatePassword.value) return;
      validatePasswordMatch(updatePassword.value, updateConfirmPassword.value, 'updatePasswordError', updateSubmitBtn);
    });
  }

  if (updateUserForm) {
    updateUserForm.addEventListener('submit', async (event) => {
      event.preventDefault();

      const updatePw = updatePassword ? updatePassword.value : '';
      const updateConfirmPw = updateConfirmPassword ? updateConfirmPassword.value : '';

      if (updatePw || updateConfirmPw) {
        if (!validatePasswordMatch(updatePw, updateConfirmPw, 'updatePasswordError', updateSubmitBtn)) return;
      }

      const userIdEl = document.getElementById('updateUserId');
      if (!userIdEl || !userIdEl.value) return;

      const formData = new FormData(updateUserForm);
      const data = Object.fromEntries(formData.entries());

      if (!data.password) {
        delete data.password;
        delete data.confirmPassword;
      }

      if (data.lat) data.lat = parseFloat(data.lat);
      if (data.lon) data.lon = parseFloat(data.lon);

      try {
        const response = await fetch(`/api/v1/users/${userIdEl.value}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(data)
        });

        if (response.ok) {
          location.reload();
        } else {
          const error = await response.json();
          alert(`Error: ${error.message}`);
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error updating user:', error);
        alert('An error occurred while updating the user.');
      }
    });
  }

  // ===== Profiles management =====
  async function fetchProfiles() {
    const resp = await fetch('/api/v1/profiles');
    if (!resp.ok) return [];
    const json = await resp.json();
    return json.data || [];
  }

  async function renderProfiles() {
    const profiles = await fetchProfiles();

    const container = document.getElementById('profilesList');
    if (container) {
      if (profiles.length === 0) {
        container.innerHTML = '<div class="alert alert-secondary">No profiles</div>';
      } else {
        let html = '<ul class="list-group">';
        profiles.forEach((p) => {
          html += `<li class="list-group-item d-flex justify-content-between align-items-center">${p.profileName} <span class="badge bg-${p.isAdmin ? 'danger' : 'secondary'}">${p.isAdmin}</span></li>`;
        });
        html += '</ul>';
        container.innerHTML = html;
      }
    }

    // populate select elements in the users table
    const selects = document.querySelectorAll('.assign-profile-select');
    selects.forEach((sel) => {
      const defaultOpt = sel.querySelector('option[value=""]');
      sel.innerHTML = '';

      const baseOpt = defaultOpt || document.createElement('option');
      baseOpt.value = '';
      baseOpt.text = '-- none --';
      sel.appendChild(baseOpt);

      profiles.forEach((p) => {
        const o = document.createElement('option');
        o.value = String(p._id);
        o.text = p.profileName + (p.isAdmin ? ' (admin)' : '');
        sel.appendChild(o);
      });
    });

    // Populate the edit/update form profile dropdown
    const updateProfileSelect = document.getElementById('updateProfile');
    if (updateProfileSelect) {
      updateProfileSelect.innerHTML = '<option value="">-- No Profile --</option>';
      profiles.forEach((p) => {
        const o = document.createElement('option');
        o.value = String(p._id);
        o.text = p.profileName + (p.isAdmin ? ' (admin)' : '');
        updateProfileSelect.appendChild(o);
      });
    }

    return profiles;
  }

  const createProfileForm = document.getElementById('createProfileForm');
  if (createProfileForm) {
    createProfileForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nameEl = document.getElementById('profileName');
      const isAdminEl = document.getElementById('isAdmin');
      if (!nameEl || !isAdminEl) return;

      const name = nameEl.value;
      const isAdmin = isAdminEl.value === 'true';

      try {
        const resp = await fetch('/api/v1/profiles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profileName: name, isAdmin })
        });

        if (resp.ok) {
          await renderProfiles();
          nameEl.value = '';
        } else {
          const text = await resp.text();
          alert('Failed to create profile: ' + text);
        }
      } catch (err) {
        alert('Error creating profile: ' + err.message);
      }
    });
  }

  // assign profile handlers
  document.addEventListener('click', async (ev) => {
    const btn = ev.target.closest('.assign-profile-btn');
    if (!btn) return;

    const userId = btn.getAttribute('data-user-id');
    const sel = document.querySelector(`.assign-profile-select[data-user-id="${userId}"]`);
    if (!sel) return;

    const profileId = sel.value;

    try {
      const resp = await fetch(`/api/v1/users/${userId}/assign-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId })
      });

      if (resp.ok) {
        alert('Profile assigned');
      } else {
        const txt = await resp.text();
        alert('Assign failed: ' + txt);
      }
    } catch (e) {
      alert('Assign error: ' + e.message);
    }
  });

  // initial render and set select values
  const usersClient = Array.isArray(window.__USERS__) ? window.__USERS__ : [];

  (async () => {
    await renderProfiles();

    try {
      usersClient.forEach((u) => {
        const sel = document.querySelector(`.assign-profile-select[data-user-id="${u._id}"]`);
        if (sel && u.profileId) sel.value = u.profileId;
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('Could not set user profile selects:', e);
    }
  })();

  // ===== Modal edit user =====
  document.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.edit-user-btn');
    if (!btn) return;

    const userId = btn.getAttribute('data-user-id');
    const userName = btn.getAttribute('data-user-name');
    const userEmail = btn.getAttribute('data-user-email');
    const userLat = btn.getAttribute('data-user-lat');
    const userLon = btn.getAttribute('data-user-lon');

    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val;
    };

    setVal('editUserId', userId);
    setVal('editName', userName);
    setVal('editEmail', userEmail);
    setVal('editLat', userLat);
    setVal('editLon', userLon);
    setVal('editPassword', '');
    setVal('editConfirmPassword', '');

    const group = document.getElementById('editConfirmPasswordGroup');
    if (group) group.style.display = 'none';

    try {
      const modalEl = document.getElementById('editUserModal');
      if (modalEl && typeof mdb !== 'undefined' && mdb.Modal) {
        const modal = new mdb.Modal(modalEl);
        modal.show();
      }
    } catch (_e) {
      // ignore
    }
  });

  const editPassword = document.getElementById('editPassword');
  const editConfirmPassword = document.getElementById('editConfirmPassword');
  const editConfirmPasswordGroup = document.getElementById('editConfirmPasswordGroup');
  const saveUserBtn = document.getElementById('saveUserBtn');

  if (editPassword && editConfirmPasswordGroup) {
    editPassword.addEventListener('focus', () => {
      editConfirmPasswordGroup.style.display = 'block';
    });

    editPassword.addEventListener('input', () => {
      if (!editConfirmPassword) return;

      if (editPassword.value) {
        editConfirmPasswordGroup.style.display = 'block';
        validatePasswordMatch(editPassword.value, editConfirmPassword.value, 'editPasswordError', saveUserBtn);
      } else {
        editConfirmPasswordGroup.style.display = 'none';
        editConfirmPassword.value = '';
        const err = document.getElementById('editPasswordError');
        if (err) err.style.display = 'none';
        if (saveUserBtn) saveUserBtn.disabled = false;
      }
    });
  }

  if (editConfirmPassword && editPassword) {
    editConfirmPassword.addEventListener('input', () => {
      if (!editPassword.value) return;
      validatePasswordMatch(editPassword.value, editConfirmPassword.value, 'editPasswordError', saveUserBtn);
    });
  }

  if (saveUserBtn) {
    saveUserBtn.addEventListener('click', async () => {
      const editPw = editPassword ? editPassword.value : '';
      const editConfirmPw = editConfirmPassword ? editConfirmPassword.value : '';

      if (editPw || editConfirmPw) {
        if (!validatePasswordMatch(editPw, editConfirmPw, 'editPasswordError', saveUserBtn)) return;
      }

      const userIdEl = document.getElementById('editUserId');
      const form = document.getElementById('editUserForm');
      if (!userIdEl || !form) return;

      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());

      if (!data.password) {
        delete data.password;
        delete data.confirmPassword;
      }

      if (data.lat) data.lat = parseFloat(data.lat);
      if (data.lon) data.lon = parseFloat(data.lon);

      try {
        const response = await fetch(`/api/v1/users/${userIdEl.value}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(data)
        });

        if (response.ok) {
          location.reload();
        } else {
          const error = await response.json();
          alert(`Error: ${error.message}`);
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error updating user:', error);
        alert('An error occurred while updating the user.');
      }
    });
  }
});
