const emailEl = document.querySelector("#email");
// const passwordEl = document.querySelector("#password");
const form = document.querySelector("#register_form");

const isRequired = (value) => (value === "" ? false : true);

const checkEmail = () => {
  let valid = false;
  const email = emailEl.value.trim();
  if (!isRequired(email)) {
    showError(emailEl, "Email cannot be blank.");
  } else if (!isEmailValid(email)) {
    showError(emailEl, "Email is not valid.");
  } else {
    showSuccess(emailEl);
    valid = true;
  }
  return valid;
};

// const checkPassword = () => {
//     let valid = false;

//     const password = passwordEl.value.trim();

//     if (!isRequired(password)) {
//         showError(passwordEl, 'Password cannot be blank.');
//     } else if (!isPasswordSecure(password)) {
//         showError(passwordEl, 'Password must has at least 8 characters that include at least 1 lowercase character, 1 uppercase characters, 1 number, and 1 special character in (!@#$%^&*)');
//     } else {
//         showSuccess(passwordEl);
//         valid = true;
//     }

//     return valid;
// };
let isEmailValid = (email) => {
  const re =
    /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(email);
};

// let isPasswordSecure = (password) => {
//   const re = new RegExp(
//     "^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])(?=.{8,})"
//   );
//   return re.test(password);
// };

const showError = (input, message) => {
  // get the form-field element
  const formField = input.parentElement;
  // add the error class
  input.classList.remove("success", "is-valid");
  input.classList.add("error", "is-invalid");

  // show the error message
  const error = formField.querySelector("small");
  error.classList.add("text-danger");
  error.textContent = message;
};

const showSuccess = (input) => {
  // get the form-field element
  const formField = input.parentElement;

  // remove the error class
  input.classList.remove("error", "is-invalid");
  input.classList.add("success", "is-valid");

  // hide the error message
  const error = formField.querySelector("small");
  error.textContent = "";
};
form.addEventListener("submit", function (e) {
  // prevent the form from submitting
  e.preventDefault();

  // validate fields

  isEmailValid = checkEmail();
  //   (isPasswordValid = checkPassword());

  let isFormValid = isEmailValid;
  //    && isPasswordValid;

  // submit to the server if the form is valid
  if (isFormValid) {
    form.submit();
  }
});

const debounce = (fn, delay = 500) => {
  let timeoutId;
  return (...args) => {
    // cancel the previous timer
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    // setup a new timer
    timeoutId = setTimeout(() => {
      fn.apply(null, args);
    }, delay);
  };
};

form.addEventListener(
  "input",
  debounce(function (e) {
    switch (e.target.id) {
      case "email":
        checkEmail();
        break;
      //   case "password":
      //     checkPassword();
      //     break;
    }
  })
);