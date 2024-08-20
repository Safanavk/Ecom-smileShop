const emailEl = document.querySelector("#email");
const passwordEl = document.querySelector("#password");
const form = document.querySelector('#login_form'); 


const isRequired = value => value !== '';


const isEmailValid = (email) => {
    const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(email);
};


function isPasswordSecure(password) {
    const re = new RegExp("^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^&\*])(?=.{8,})");
    return re.test(password);
}

const showError = (input, message) => {
    const formField = input.parentElement;
    input.classList.remove('success', 'is-valid');
    input.classList.add('error', 'is-invalid');
    const error = formField.querySelector('small');
    error.classList.add('text-danger');
    error.textContent = message;
};

const showSuccess = (input) => {
    const formField = input.parentElement;
    input.classList.remove('error', 'is-invalid');
    input.classList.add('success', 'is-valid');
    const error = formField.querySelector('small');
    error.textContent = '';
};

const checkEmail = () => {
    let valid = false;
    const email = emailEl.value.trim();
    if (!isRequired(email)) {
        showError(emailEl, 'Email cannot be blank.');
    } else if (!isEmailValid(email)) {
        showError(emailEl, 'Email is not valid.');
    } else {
        showSuccess(emailEl);
        valid = true;
    }
    return valid;
};

const checkPassword = () => {
    let valid = false;
    const password = passwordEl.value.trim();
    if (!isRequired(password)) {
        showError(passwordEl, 'Password cannot be blank.');
    } else if (!isPasswordSecure(password)) {
        showError(passwordEl, 'Password must have at least 8 characters that include at least 1 lowercase character, 1 uppercase character, 1 number, and 1 special character in (!@#$%^&*).');
    } else {
        showSuccess(passwordEl);
        valid = true;
    }
    return valid;
};

form.addEventListener('submit', function (e) {
    e.preventDefault();
    const emailValid = checkEmail();
    const passwordValid = checkPassword();
    let isFormValid = emailValid && passwordValid;
    if (isFormValid) {
        form.submit();
    }
});

const debounce = (fn, delay = 500) => {
    let timeoutId;
    return (...args) => {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => {
            fn.apply(null, args);
        }, delay);
    };
};

form.addEventListener('input', debounce(function (e) {
    switch (e.target.id) {
        case 'email':
            checkEmail();
            break;
        case 'password':
            checkPassword();
            break;
    }
}));