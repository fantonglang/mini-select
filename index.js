(function(global) {
  var requestId = 0;
  function template(id, selected, ac, placeholder) {
    return `
    <div class="mini-select ${ac? 'ms-ac': ''}" data-id="${id}">
      <input type="text" class="dummy">
      <div class="ms-display">
        ${selected ? `
          <div class="ms-selected-text" ms-selected-id="${selected.id}">
            ${selected.text}
          </div>`: `<div class="ms-selected-text">${placeholder ? placeholder : ''}</div>`
        }
        <div class="ms-arrow"></div>
      </div>
      ${ac? `
        <div class="ms-inp">
          <input type="text" class="ms-input" placeholder="search..." autocomplete="off" />
        </div>`: ''
      }
      <div class="ms-options">
        ${selected? optionTemplate(selected.id, selected.text, true, true): ''}
      </div>
    </div>`;
  }
  function optionTemplate(id, text, selected, hover) {
    return `<div class="ms-option ${selected ? 'ms-selected' : ''} ${hover? 'ms-hover': ''}" ms-id="${id}">${text}</div>`;
  }
  function option_div(id, text, selected) {
    const div = document.createElement('div');
    div.className = 'ms-option';
    div.setAttribute('ms-id', id);
    div.innerHTML = text;
    if (selected) {
      div.classList.add('ms-selected');
    }
    appendHoverHooks([div]);
    return div;
  }
  function optionInSelect(id, text, selected) {
    const opt = document.createElement('option');
    opt.value = id;
    opt.text = text;
    if (selected) {
      opt.selected = true;
    }
    return opt;
  }
  function appendHoverHooks(els) {
    els.forEach(function(el) {
      el.addEventListener('mouseover', function() {
        this.parentNode.querySelectorAll('.ms-option').forEach(function(sibling) {
          sibling.classList.remove('ms-hover');
        });
        this.classList.add('ms-hover');
      });
    })
  }
  function initMiniSelect(el, options) {
    options = options || {};
    if (el.dataset.miniSelectInited) {
      return;
    }
    if (!el.id) {
      el.id = `mini-select-${uuid()}`;
    }
    el.style.display = 'none';
    el.dataset.miniSelectInited = true;

    var ac = !!options.url;
    el.insertAdjacentHTML('afterend', template(el.id, options.selected, ac, el.getAttribute('placeholder')));
    const root = document.querySelector(`.mini-select[data-id="${el.id}"]`);
    const existingOptions = root.querySelectorAll('.ms-option');
    if (existingOptions.length > 0) {
      appendHoverHooks(existingOptions);
    }
    const input = root.querySelector('.ms-inp input');
    const elOptions = root.querySelector('.ms-options');
    let page = 1;
    let hasMore = true;
    let loading = false;

    if (root.querySelector('.ms-selected-text[ms-selected-id]')) {
      const id = root.querySelector('.ms-selected-text').getAttribute('ms-selected-id');
      const text = root.querySelector('.ms-selected-text').innerHTML;
      el.appendChild(optionInSelect(id, text, true));
    }

    async function onSearch(isMore = false) {
      requestId++;
      var currentId = requestId;
      if (!isMore) {
        elOptions.innerHTML = '';
        page = 1;
        hasMore = true;
        el.innerHtml = '';
        el.appendChild(optionInSelect('', '', false));
      }
      const selectedId = root.querySelector('.ms-selected-text').getAttribute('ms-selected-id');
      const resp = await fetch(`${options.url}?q=${input.value}&page=${page}&uuid=${uuid()}`);
      const data = await resp.json();
      if (currentId !== requestId) {
        return;
      }
      if (data.pagination && data.pagination.more) {
        hasMore = true;
      } else {
        hasMore = false;
      }
      data.results.forEach(function(item) {
        elOptions.appendChild(option_div(item.id, item.text, item.id == selectedId));
        el.appendChild(optionInSelect(item.id, item.text, item.id == selectedId));
      });
    }

    root.querySelector('.ms-display').addEventListener('click', async function() {
      if (input) {
        if (!root.classList.contains('ms-open')) {
          setTimeout(function() {
            input.focus();
          }, 300);
          if (elOptions.children.length === 0) {
            onSearch();
          }
        } else {
          input.blur();
        }
      }
      root.classList.toggle('ms-open');
      root.classList.remove('ms-focus');
    });

    if (input) {
      input.addEventListener('input', debounce(function() {
        onSearch();
      }, 250));
      // when elOptions scrool to bottom, load more
      elOptions.addEventListener('scroll', async function() {
        if (elOptions.scrollHeight - elOptions.scrollTop <= elOptions.clientHeight + 10 && hasMore) {
          if (loading) {
            return;
          }
          loading = true;
          page++;
          await onSearch(true);
          loading = false;
        }
      });
    }

    if (options.data) {
      elOptions.innerHTML = '';
      el.appendChild(optionInSelect('', '', false));
      options.data.forEach(function(item) {
        elOptions.appendChild(option_div(item.id, item.text, item.selected));
        el.appendChild(optionInSelect(item.id, item.text, item.selected));
      });
    }

    eventDelegation(elOptions, '.ms-option', 'click', function() {
      const selectedId = this.getAttribute('ms-id');
      root.querySelector('.ms-selected-text').setAttribute('ms-selected-id', selectedId);
      root.querySelector('.ms-selected-text').innerHTML = this.innerHTML;
      root.querySelectorAll('.ms-option').forEach(function(opt) {
        opt.classList.remove('ms-selected');
      });
      this.classList.add('ms-selected');
      el.value = selectedId; // Update the original select element value
      // console.log(`Selected: ${selectedId}`);
      // send change event to the original select element
      const event = new Event('change', { bubbles: true });
      el.dispatchEvent(event);
      root.classList.remove('ms-open');
    });

    root.querySelector('.dummy').addEventListener('focus', function() {
      root.classList.add('ms-focus');
    });
    root.querySelector('.dummy').addEventListener('blur', function() {
      root.classList.remove('ms-focus');
    });
    root.querySelector('.dummy').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.blur();
        setTimeout(function() {
          root.querySelector('.ms-display').click();
        }, 0);
      }
    });

    // add up/down arrow keys support
    document.addEventListener('keydown', function(e) {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Enter') {
        return;
      }
      if (!root.classList.contains('ms-open')) {
        return;
      }
      e.preventDefault();
      if (e.key === 'ArrowDown') {
        let hoverItem = elOptions.querySelector('.ms-option.ms-hover');
        let nextItem = null;
        if (!hoverItem) {
          const firstItem = elOptions.querySelector('.ms-option');
          if (firstItem) {
            nextItem = firstItem;
          }
        } else {
          if (hoverItem.nextElementSibling) {
            nextItem = hoverItem.nextElementSibling;
          } else {
            return;
          }
        }
        hoverItem && hoverItem.classList.remove('ms-hover');
        nextItem.classList.add('ms-hover');
        if (nextItem.offsetTop + nextItem.offsetHeight >= elOptions.scrollTop + elOptions.clientHeight) {
          elOptions.scrollTop = nextItem.offsetTop - (elOptions.clientHeight - nextItem.offsetHeight);
        }
      }
      if (e.key === 'ArrowUp') {
        const hoverItem = elOptions.querySelector('.ms-option.ms-hover');
        if (!hoverItem || !hoverItem.previousElementSibling) {
          return;
        }
        const prevItem = hoverItem.previousElementSibling;
        hoverItem.classList.remove('ms-hover');
        prevItem.classList.add('ms-hover');
        if (prevItem.offsetTop < elOptions.scrollTop) {
          elOptions.scrollTop = prevItem.offsetTop;
        }
      }
      if (e.key === 'Enter') {
        const hoverItem = elOptions.querySelector('.ms-option.ms-hover');
        if (hoverItem) {
          hoverItem.click();
        }
      }
    });
  }

  function debounce(func, wait) {
    let timeout;
    return function(...args) {
      const context = this;
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(context, args), wait);
    };
  }
  function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  function eventDelegation(root, selector, event, callback) {
    root.addEventListener(event, function(e) {
      var target = e.target;
      while (target && target !== root) {
        if (target.matches(selector)) {
          callback.call(target, e);
          break;
        }
        target = target.parentNode;
      }
    });
  }

  global.initMiniSelect = initMiniSelect;

  document.addEventListener('DOMContentLoaded', function() {
    document.body.addEventListener('click', function(e) {
      var selects = document.querySelectorAll('.mini-select');
      var selected = e.target.closest('.mini-select');

      selects.forEach(p => {
        if (p !== selected) {
          p.classList.remove('ms-open');
        }
      });
    });
  });
})(window);