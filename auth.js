// ============ AUTH & APP LOCK SYSTEM ============
let appLockPin = null;
let pinAttempts = 0;
let pinInput = '';
let isUnlocked = false;

// ============ FORM NAVIGATION ============
function showSignup() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('signupForm').style.display = 'block';
    document.getElementById('forgotForm').style.display = 'none';
    document.getElementById('resetForm').style.display = 'none';
    document.getElementById('loginError').style.display = 'none';
}

function showLogin() {
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('signupForm').style.display = 'none';
    document.getElementById('forgotForm').style.display = 'none';
    document.getElementById('resetForm').style.display = 'none';
    document.getElementById('loginError').style.display = 'none';
    document.getElementById('loginEmail').value = '';
    document.getElementById('loginPassword').value = '';
}

function showForgotPassword() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('signupForm').style.display = 'none';
    document.getElementById('forgotForm').style.display = 'block';
    document.getElementById('resetForm').style.display = 'none';
    document.getElementById('forgotError').style.display = 'none';
    document.getElementById('forgotEmail').value = '';
}

// ============ CUSTOM DIALOGS ============
function showCustomAlert(message, icon = '⚠️') {
    document.getElementById('alertIcon').textContent = icon;
    document.getElementById('alertMessage').textContent = message;
    document.getElementById('customAlert').style.display = 'flex';
}

function closeCustomAlert() {
    document.getElementById('customAlert').style.display = 'none';
}

let confirmCallback = null;
function showCustomConfirm(message, callback) {
    document.getElementById('confirmMessage').textContent = message;
    document.getElementById('customConfirm').style.display = 'flex';
    confirmCallback = callback;
}

function confirmAction(result) {
    document.getElementById('customConfirm').style.display = 'none';
    if (confirmCallback) confirmCallback(result);
    confirmCallback = null;
}

let promptCallback = null;
function showCustomPrompt(message, callback) {
    document.getElementById('promptMessage').textContent = message;
    document.getElementById('promptInput').value = '';
    document.getElementById('customPrompt').style.display = 'flex';
    promptCallback = callback;
}

function promptAction(result) {
    const value = document.getElementById('promptInput').value;
    document.getElementById('customPrompt').style.display = 'none';
    if (promptCallback) promptCallback(result ? value : null);
    promptCallback = null;
}

// ============ TERMS & PRIVACY ============
function showTerms() {
    document.getElementById('termsModal').style.display = 'flex';
}

function showPrivacyPolicyText() {
    document.getElementById('privacyModal').style.display = 'flex';
}

// ============ AUTH FUNCTIONS ============
async function signupUser() {
    if (!isOnline) {
        showCustomAlert('No internet connection');
        return;
    }

    const nickname = document.getElementById('signupNickname').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    const agreed = document.getElementById('agreeTerms').checked;
    const errorEl = document.getElementById('signupError');

    if (!agreed) {
        errorEl.textContent = 'You must agree to Terms & Conditions';
        errorEl.style.display = 'block';
        return;
    }
    if (!nickname || nickname.length > 20 || !/^[a-zA-Z]+$/.test(nickname)) {
        errorEl.textContent = 'Nickname: letters only, max 20 characters';
        errorEl.style.display = 'block';
        return;
    }
    if (!email || password.length < 6) {
        errorEl.textContent = 'Valid email and password (6+ chars) required';
        errorEl.style.display = 'block';
        return;
    }

    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        await db.collection('users').doc(userCredential.user.uid).set({
            nickname: nickname,
            email: email,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
            profilePic: null,
            hidePfp: false,
            pfpExceptions: [],
            appLockPin: null
        });
        errorEl.style.display = 'none';
    } catch (error) {
        if (error.code === 'auth/email-already-in-use') {
            errorEl.textContent = 'This email is already registered. Please log in.';
        } else {
            errorEl.textContent = error.message.replace('Firebase: ', '');
        }
        errorEl.style.display = 'block';
    }
}

async function loginUser() {
    if (!isOnline) {
        showCustomAlert('No internet connection');
        return;
    }

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errorEl = document.getElementById('loginError');

    if (!email || !password) {
        errorEl.textContent = 'Enter email and password';
        errorEl.style.display = 'block';
        return;
    }

    try {
        await auth.signInWithEmailAndPassword(email, password);
        errorEl.style.display = 'none';
    } catch (error) {
        errorEl.textContent = 'Invalid email or password';
        errorEl.style.display = 'block';
    }
}

// ============ FORGOT PASSWORD ============
let resetEmail = '';
let resetCooldown = false;

async function sendResetCode() {
    const email = document.getElementById('forgotEmail').value.trim();
    const errorEl = document.getElementById('forgotError');

    if (!email) {
        errorEl.textContent = 'Enter your email address';
        errorEl.style.display = 'block';
        return;
    }

    if (resetCooldown) {
        errorEl.textContent = 'Please wait 60 seconds';
        errorEl.style.display = 'block';
        return;
    }

    try {
        const snapshot = await db.collection('users').where('email', '==', email).get();
        if (snapshot.empty) {
            errorEl.textContent = 'No account found with this email';
            errorEl.style.display = 'block';
            return;
        }

        resetEmail = email;
        const code = Math.floor(1000000 + Math.random() * 9000000).toString();

        await db.collection('resetCodes').doc(email).set({
            code: code,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            expiresAt: new Date(Date.now() + 15 * 60 * 1000)
        });

        // Send password reset email via Firebase
        await auth.sendPasswordResetEmail(email);

        showCustomAlert('✅ A 7-digit verification code has been sent to your email.\n\nCheck your inbox and spam folder.\n\nCode for testing: ' + code, '📧');

        document.getElementById('forgotForm').style.display = 'none';
        document.getElementById('resetForm').style.display = 'block';
        document.getElementById('resetError').style.display = 'none';
        document.getElementById('resetCode').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmPassword').value = '';

        resetCooldown = true;
        setTimeout(() => { resetCooldown = false; }, 60000);

        errorEl.style.display = 'none';

    } catch (error) {
        errorEl.textContent = error.message;
        errorEl.style.display = 'block';
    }
}

async function resetPassword() {
    const code = document.getElementById('resetCode').value.trim();
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const errorEl = document.getElementById('resetError');

    if (!code || code.length !== 7) {
        errorEl.textContent = 'Enter the 7-digit code from your email';
        errorEl.style.display = 'block';
        return;
    }
    if (newPassword.length < 6) {
        errorEl.textContent = 'Password must be at least 6 characters';
        errorEl.style.display = 'block';
        return;
    }
    if (newPassword !== confirmPassword) {
        errorEl.textContent = 'Passwords do not match';
        errorEl.style.display = 'block';
        return;
    }

    try {
        const doc = await db.collection('resetCodes').doc(resetEmail).get();
        
        if (!doc.exists) {
            errorEl.textContent = 'No reset code found. Request a new one.';
            errorEl.style.display = 'block';
            return;
        }

        const data = doc.data();
        if (new Date() > data.expiresAt.toDate()) {
            errorEl.textContent = 'Code expired. Request a new one.';
            errorEl.style.display = 'block';
            await db.collection('resetCodes').doc(resetEmail).delete();
            return;
        }
        if (data.code !== code) {
            errorEl.textContent = 'Invalid code. Check your email.';
            errorEl.style.display = 'block';
            return;
        }

        await db.collection('resetCodes').doc(resetEmail).delete();
        await auth.sendPasswordResetEmail(resetEmail);

        showCustomAlert('✅ Password reset email sent!\n\nCheck your email and click the link to reset your password.\n\nThen log in with your new password.', '✅');

        document.getElementById('resetForm').style.display = 'none';
        document.getElementById('loginForm').style.display = 'block';
        document.getElementById('loginEmail').value = resetEmail;
        document.getElementById('loginPassword').value = '';
        resetEmail = '';

    } catch (error) {
        errorEl.textContent = error.message;
        errorEl.style.display = 'block';
    }
}

// ============ APP LOCK SYSTEM ============
function addPin(digit) {
    if (pinInput.length >= 4) return;
    pinInput += digit;
    updatePinDots();
    
    if (pinInput.length === 4) {
        setTimeout(submitPin, 200);
    }
}

function clearPin() {
    pinInput = pinInput.slice(0, -1);
    updatePinDots();
}

function updatePinDots() {
    const dots = document.querySelectorAll('.pin-dot');
    dots.forEach((dot, i) => {
        if (i < pinInput.length) {
            dot.classList.add('filled');
        } else {
            dot.classList.remove('filled');
        }
    });
}

function submitPin() {
    if (pinInput.length !== 4) return;
    
    if (pinInput === appLockPin) {
        pinInput = '';
        updatePinDots();
        isUnlocked = true;
        document.getElementById('lockScreen').style.display = 'none';
        document.getElementById('pinError').style.display = 'none';
        pinAttempts = 0;
    } else {
        pinInput = '';
        updatePinDots();
        pinAttempts++;
        document.getElementById('pinError').textContent = 'Wrong PIN. ' + (5 - pinAttempts) + ' attempts left';
        document.getElementById('pinError').style.display = 'block';
        
        if (pinAttempts >= 5) {
            document.getElementById('pinError').textContent = 'Too many attempts. Use forgot password.';
            pinAttempts = 0;
        }
    }
}

function lockApp() {
    if (!appLockPin || isUnlocked) return;
    isUnlocked = false;
    pinInput = '';
    updatePinDots();
    document.getElementById('pinError').style.display = 'none';
    document.getElementById('lockScreen').style.display = 'flex';
}

async function toggleAppLock() {
    const toggle = document.getElementById('appLockToggle');
    
    if (toggle.checked) {
        // Set up new PIN
        showCustomPrompt('Create a 4-digit PIN for app lock:', async (pin) => {
            if (!pin || pin.length !== 4 || !/^\d+$/.test(pin)) {
                showCustomAlert('PIN must be exactly 4 digits', '❌');
                toggle.checked = false;
                return;
            }
            
            showCustomPrompt('Confirm your PIN:', async (confirmPin) => {
                if (pin !== confirmPin) {
                    showCustomAlert('PINs do not match', '❌');
                    toggle.checked = false;
                    return;
                }
                
                appLockPin = pin;
                await db.collection('users').doc(currentUser.uid).update({
                    appLockPin: pin
                });
                showCustomAlert('App lock enabled! 🔒', '✅');
            });
        });
    } else {
        // Disable PIN
        showCustomPrompt('Enter your current PIN to disable:', async (pin) => {
            if (pin === appLockPin) {
                appLockPin = null;
                await db.collection('users').doc(currentUser.uid).update({
                    appLockPin: null
                });
                showCustomAlert('App lock disabled', '✅');
            } else {
                showCustomAlert('Wrong PIN', '❌');
                toggle.checked = true;
            }
        });
    }
}

async function forgotAppPassword() {
    showCustomConfirm('Reset app lock? This requires your account email and password.', async (confirmed) => {
        if (!confirmed) return;
        
        showCustomPrompt('Enter your account email:', (email) => {
            if (email !== currentUser?.email) {
                showCustomAlert('Wrong email', '❌');
                return;
            }
            
            showCustomPrompt('Enter your account password:', async (password) => {
                try {
                    const credential = firebase.auth.EmailAuthProvider.credential(email, password);
                    await currentUser.reauthenticateWithCredential(credential);
                    
                    appLockPin = null;
                    await db.collection('users').doc(currentUser.uid).update({
                        appLockPin: null
                    });
                    
                    document.getElementById('lockScreen').style.display = 'none';
                    document.getElementById('appLockToggle').checked = false;
                    isUnlocked = true;
                    
                    showCustomAlert('App lock removed! You can set a new one in Profile.', '✅');
                    
                } catch (error) {
                    showCustomAlert('Wrong password', '❌');
                }
            });
        });
    });
}

// ============ AUTH STATE LISTENER ============
auth.onAuthStateChanged(async (user) => {
    const authScreen = document.getElementById('authScreen');
    const mainScreen = document.getElementById('mainScreen');
    const lockScreen = document.getElementById('lockScreen');

    if (user) {
        currentUser = user;
        
        const doc = await db.collection('users').doc(user.uid).get();
        if (doc.exists) {
            userProfile = doc.data();
            
            // Update last seen
            await db.collection('users').doc(user.uid).update({
                lastSeen: firebase.firestore.FieldValue.serverTimestamp()
            });

            authScreen.classList.remove('active');
            authScreen.style.display = 'none';
            mainScreen.classList.add('active');
            mainScreen.style.display = 'flex';
            
            document.getElementById('loginEmail').value = '';
            document.getElementById('loginPassword').value = '';
            
            // Check app lock
            appLockPin = userProfile.appLockPin || null;
            if (appLockPin) {
                document.getElementById('appLockToggle').checked = true;
                lockScreen.style.display = 'flex';
                isUnlocked = false;
                pinInput = '';
                updatePinDots();
            } else {
                document.getElementById('appLockToggle').checked = false;
                isUnlocked = true;
            }
            
            updateProfilePicDisplay();
            loadChats();
        }
    } else {
        currentUser = null;
        userProfile = null;
        appLockPin = null;
        isUnlocked = false;
        
        mainScreen.classList.remove('active');
        mainScreen.style.display = 'none';
        lockScreen.style.display = 'none';
        authScreen.classList.add('active');
        authScreen.style.display = 'flex';
        showLogin();
        
        if (unsubscribeChats) unsubscribeChats();
    }
});

// Lock app when switching tabs/windows
document.addEventListener('visibilitychange', () => {
    if (document.hidden && appLockPin && !isUnlocked === false) {
        // Don't lock if just unlocked
    } else if (document.hidden && appLockPin) {
        lockApp();
    }
});

async function logoutUser() {
    await auth.signOut();
    closeModal('profileModal');
}

// ============ DELETE ACCOUNT ============
async function deleteAccount() {
    showCustomConfirm('⚠️ DELETE ACCOUNT?\n\nThis action is UNRECOVERABLE.\nAll your data, messages, and profile will be permanently deleted from the database.', async (confirmed) => {
        if (!confirmed) return;

        showCustomPrompt('Enter your password to confirm:', async (password) => {
            if (!password) return;

            try {
                const credential = firebase.auth.EmailAuthProvider.credential(currentUser.email, password);
                await currentUser.reauthenticateWithCredential(credential);

                // Delete profile picture from storage
                if (userProfile.profilePic) {
                    try {
                        await storage.ref(`profilePics/${currentUser.uid}`).delete();
                    } catch (e) {}
                }

                // Delete all user's chats and messages
                const chatsSnapshot = await db.collection('chats').where('members', 'array-contains', currentUser.uid).get();
                for (const chatDoc of chatsSnapshot.docs) {
                    const msgs = await db.collection('chats').doc(chatDoc.id).collection('messages').get();
                    for (const msgDoc of msgs.docs) await msgDoc.ref.delete();
                    
                    const chat = chatDoc.data();
                    if (chat.createdBy === currentUser.uid) {
                        await chatDoc.ref.delete();
                    } else {
                        await chatDoc.ref.update({ 
                            members: firebase.firestore.FieldValue.arrayRemove(currentUser.uid),
                            kickedMembers: firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
                        });
                    }
                }

                // Delete reset codes
                const resetDocs = await db.collection('resetCodes').where('__name__', '==', currentUser.email).get();
                for (const doc of resetDocs.docs) await doc.ref.delete();

                // Delete user profile document
                await db.collection('users').doc(currentUser.uid).delete();

                // Delete Firebase Auth account
                await currentUser.delete();

                showCustomAlert('✅ Account permanently deleted from database.\nYou can create a new account with the same email.', '✅');

            } catch (error) {
                if (error.code === 'auth/wrong-password') {
                    showCustomAlert('Wrong password. Account not deleted.', '❌');
                } else if (error.code === 'auth/requires-recent-login') {
                    showCustomAlert('Please log out and log in again first.', '❌');
                } else {
                    showCustomAlert('Error: ' + error.message, '❌');
                }
            }
        });
    });
}