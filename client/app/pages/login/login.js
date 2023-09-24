import dynamicInput from '@/lib/dynamicInput';
import pattern from '@/lib/regex';

const authForm = document.querySelector('.auth-form');
const idInput = dynamicInput.create('전화번호 혹은 사용자 이름', {
  type: 'text',
  required: 'required',
  pattern: pattern.username,
});
const passwordInput = dynamicInput.create('비밀번호', {
  type: 'text',
  required: 'required',
  pattern: pattern.password,
});
authForm.prepend(idInput, passwordInput);
dynamicInput.setDefaultStyle();
dynamicInput.inputDetector();

const cycleImage = () => {
  const iphoneImage = document.querySelector('.iphone');
  for (let i = 0; i < 5; i += 1) {
    setTimeout(() => {
      iphoneImage.childNodes[i].classList.add('iphone__screen--curr');
      if (i === 0) {
        iphoneImage.childNodes[4].classList.remove('iphone__screen--curr');
      } else iphoneImage.childNodes[i - 1].classList.remove('iphone__screen--curr');
    }, i * 7500);
  }
};
cycleImage();
setInterval(cycleImage, 37500);
