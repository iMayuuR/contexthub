/**
 * ContextHub docs — terminal theme interactions
 */

document.addEventListener('DOMContentLoaded', () => {
  const menuToggle = document.querySelector('.mobile-menu-toggle');
  const mobileNav = document.querySelector('.mobile-nav');
  const mobileLinks = document.querySelectorAll('.mobile-link');

  if (menuToggle && mobileNav) {
    menuToggle.addEventListener('click', () => {
      const isOpen = mobileNav.classList.toggle('open');
      menuToggle.setAttribute('aria-expanded', String(isOpen));

      const spans = menuToggle.querySelectorAll('span');
      if (isOpen) {
        spans[0].style.transform = 'translateY(7px) rotate(45deg)';
        spans[1].style.opacity = '0';
        spans[2].style.transform = 'translateY(-7px) rotate(-45deg)';
      } else {
        spans[0].style.transform = 'none';
        spans[1].style.opacity = '1';
        spans[2].style.transform = 'none';
      }
    });

    mobileLinks.forEach((link) => {
      link.addEventListener('click', () => {
        if (mobileNav.classList.contains('open')) {
          menuToggle.click();
        }
      });
    });
  }

  document.querySelectorAll('.copy-block').forEach((block) => {
    const btn = block.querySelector('.copy-btn');
    const text = block.dataset.copy;
    if (!btn || !text) return;

    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(text);
        btn.textContent = 'copied';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = 'copy';
          btn.classList.remove('copied');
        }, 2000);
      } catch {
        btn.textContent = 'failed';
        setTimeout(() => {
          btn.textContent = 'copy';
        }, 2000);
      }
    });
  });

  const typewriterEl = document.getElementById('typewriter');
  const terminalOutput = document.getElementById('hero-output');

  if (typewriterEl && terminalOutput) {
    const textToType = 'npx @contexthub/cli start';
    let index = 0;

    const cursor = document.createElement('span');
    cursor.className = 'cursor-blink';
    cursor.textContent = '_';

    function typeChar() {
      if (index < textToType.length) {
        if (typewriterEl.contains(cursor)) {
          typewriterEl.removeChild(cursor);
        }
        typewriterEl.textContent += textToType.charAt(index);
        typewriterEl.appendChild(cursor);
        index += 1;
        setTimeout(typeChar, 60 + Math.random() * 50);
      } else {
        setTimeout(() => {
          if (typewriterEl.contains(cursor)) {
            typewriterEl.removeChild(cursor);
          }
          terminalOutput.classList.add('show');
        }, 400);
      }
    }

    setTimeout(() => {
      typewriterEl.appendChild(cursor);
      setTimeout(typeChar, 600);
    }, 500);
  }
});
