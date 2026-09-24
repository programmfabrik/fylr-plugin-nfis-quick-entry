// A CUI.Select-compatible field with an integrated search: the same box both
// displays the current value and, once focused/typed into, filters a
// dropdown of matching options - there is only ever one visible field, never
// a text input glued next to a separate select.
//
// Drop-in usage, same as CUI.Select:
//   {
//       type: NfisQuickEntrySearchableSelect,
//       name: "someField",
//       form: { label: "..." },
//       options: () => this.optionsMap['some_vocab'],
//   }
//
// options/disabled/form/etc. all work exactly as with CUI.Select. Built by
// composing CUI.Input (the visible/editable box) with CUI.Menu + ItemList
// (the same dropdown primitive CUI.Select itself uses internally), rather
// than extending CUI.Select - Select's own "field" is a CUI.Button with a
// menu, not an editable input, so there is no way to make that same box
// double as a text filter.
class NfisQuickEntrySearchableSelect extends CUI.DataFieldInput {

    initOpts() {
        super.initOpts();
        this.addOpts({
            options: {
                mandatory: true,
                check: (v) => CUI.util.isArray(v) || CUI.util.isFunction(v)
            },
            empty_text: { check: String },
            not_found_text: { default: '- nicht gefunden -', check: String },
            placeholder: {
                check: (v) => CUI.util.isFunction(v) || CUI.util.isString(v)
            }
        });
    }

    init() {
        this.__options = null;
        this.__optionsPromise = null;
        this.__defaultValue = null;
        this.__filterText = '';
        this.__menu = null;
        this.__input = null;
        this.__suppressOpenOnFocus = false;
    }

    getOptions() {
        return this.__options || [];
    }

    getDefaultValue() {
        return this.__defaultValue;
    }

    checkValue(v) {
        return true;
    }

    // mirrors CUI.Select: works even when no form data is attached yet
    getValue() {
        if (this.hasData()) {
            return super.getValue();
        }
        return this.__value;
    }

    storeValue(value, flags) {
        if (this.hasData()) {
            super.storeValue(value, flags);
        } else {
            this.__value = value;
        }
    }

    // mirrors CUI.Select.setData: with a function-valued options opt, we
    // need options loaded *before* initData() runs getDefaultValue(),
    // otherwise the initial value would be picked before options exist
    setData(data) {
        super.setData(data, false);
        if (CUI.util.isFunction(this._options)) {
            this.__loadOptions().done(() => this.initData());
        } else {
            this.initData();
        }
    }

    __loadOptions(event) {
        if (this.__optionsPromise && this.__optionsPromise.state() === 'pending') {
            return this.__optionsPromise;
        }

        const ret = this.getArrayFromOpt('options', event, true);
        this.__optionsPromise = CUI.util.isPromise(ret) ? ret : CUI.resolvedPromise(ret);

        return this.__optionsPromise.done((options) => {
            this.__options = options;
            const firstWithValue = options.find((opt) => !CUI.util.isUndef(opt.value));
            this.__defaultValue = firstWithValue ? firstWithValue.value : null;
        });
    }

    __getFilteredOptions() {
        const filter = this.__filterText.trim().toLowerCase();
        const options = this.getOptions();
        if (!filter) {
            return options;
        }
        return options.filter((opt) => (opt.text || '').toLowerCase().includes(filter));
    }

    __getMenuOpts() {
        return {
            element: this,
            use_element_width_as_min_width: true,
            backdrop: { policy: 'click-thru' },
            onHide: () => {
                this.__filterText = '';
                this.displayValue();
            },
            itemList: {
                items: () => this.__getFilteredOptions(),
                has_items: true,
                // not onActivate: that only fires for "radio-managed" item
                // lists (ItemList.__initActiveIdx only wires it up when
                // active_item_idx is non-null), which we deliberately don't
                // set - we don't need persistent highlighting of the last
                // selection, and onClick is simpler to reason about here
                onClick: (event, btn, item, idx) => {
                    this.storeValue(item.value);
                    this.__menu.hide();
                }
            }
        };
    }

    // Menu.reload() is broken for a synchronously-resolving items function
    // (which ours always is): it nulls out its own waitblock reference
    // *before* trying to call .show() on it, throwing every time. Refresh
    // the item list ourselves instead, sidestepping that entirely - this is
    // the same mechanism reload()/setItemList() use internally, just
    // without their buggy waitblock bookkeeping.
    __refilterMenu(event) {
        if (!this.__menu || !this.__menu.isShown()) {
            return;
        }
        this.__menu.getItemList().render(this.__menu, event).done(() => {
            this.__menu.position();
        });
    }

    __openMenu(event) {
        return this.__loadOptions(event).done(() => {
            if (this.isDisabled()) {
                return;
            }
            if (!this.__menu) {
                this.__menu = new CUI.Menu(this.__getMenuOpts());
            }
            if (this.__menu.isShown()) {
                this.__refilterMenu(event);
            } else {
                this.__menu.show(event);
            }
        });
    }

    // CUI.ItemList focuses its own DOM on mouseover (so keyboard nav works
    // right after hovering) - that's real, intentional CUI behavior, not a
    // bug, but it means hovering any option always steals focus from our
    // input. We only want to treat that as a "real" blur - clear the typed
    // filter, restore the display text - when focus actually left the
    // whole widget (input + open dropdown), not when it just moved to our
    // own menu.
    __isFocusInsideWidget() {
        const active = document.activeElement;
        return !!(this.__menu?.isShown() && this.__menu.DOM.contains(active));
    }

    render() {
        super.render();

        const chevron = new CUI.Icon({ icon: 'down', class: 'nfis-searchable-select-chevron' });
        CUI.Events.listen({
            type: 'click',
            node: chevron.DOM,
            call: (ev) => {
                ev.stopPropagation();
                if (this.__menu?.isShown()) {
                    this.__menu.hide();
                } else {
                    this.__input.focus();
                }
            }
        });

        // private data: this Input manages its own displayed/typed text,
        // decoupled from the surrounding CUI.Form's data - the actual
        // selected value is committed separately via storeValue() above
        //
        // .start() matters here: a DataField only builds its real DOM
        // (the <input> tag) inside render(), which normally happens via a
        // parent form cascading render() to its own fields. This Input
        // isn't registered as a field of anything, so nothing would ever
        // call that for us - we have to drive its lifecycle ourselves,
        // same as NfisQuickEntryForm does for its own top-level CUI.Form.
        this.__input = new CUI.Input({
            data: { text: '' },
            name: 'text',
            class: 'nfis-searchable-select',
            placeholder: this._placeholder,
            incNumbers: false,
            // opts.controlElement requires either a CUI.DOMElement instance
            // or a function - CUI.Icon only extends the lighter CUI.Element
            // (no DOM/template registration), so neither the icon nor its
            // raw .DOM node satisfies that check directly; wrapping it in a
            // function is the documented escape hatch (Input.coffee calls
            // it and uses the *return* value as the raw node)
            controlElement: () => chevron.DOM,
            onFocus: (input, ev) => {
                if (this.__suppressOpenOnFocus) {
                    return;
                }
                // show the current selection as a placeholder and clear the
                // box, so the user can start typing a new filter right away
                // instead of having to clear the old value out first
                const currentText = this.__input.getValue();
                if (currentText) {
                    this.__input.setPlaceholder(currentText);
                }
                this.__filterText = '';
                this.__input.setValue('');
                this.__openMenu(ev);
            },
            onDataChanged: (changedData) => {
                this.__filterText = changedData.text || '';
                this.__openMenu();
            },
            onBlur: () => {
                // give a click/hover on a menu item a chance to register
                // before resetting the displayed text back to the stored
                // value - CUI.ItemList focuses itself on mouseover, so a
                // blur here doesn't necessarily mean focus actually left
                // the widget
                CUI.setTimeout(() => {
                    if (this.__isFocusInsideWidget()) {
                        return;
                    }
                    this.__menu?.hide();
                    this.displayValue();
                }, 150);
            }
        }).start();

        // forward menu navigation keys to the open dropdown - typing focus
        // stays on our own input, so these never reach the menu's DOM on
        // their own the way they would for a native CUI.Select button
        CUI.Events.listen({
            type: 'keydown',
            node: this.__input.DOM,
            capture: true,
            call: (ev) => {
                const key = ev.getKeyboardKey();
                // getKeyboardKey() reports the Enter key as "Return", not "Enter"
                if (!['Up', 'Down', 'Return', 'Esc'].includes(key)) {
                    return;
                }

                if (!this.__menu || !this.__menu.isShown()) {
                    this.__openMenu(ev);
                    return;
                }

                if (key === 'Esc') {
                    this.__menu.hide();
                } else {
                    CUI.Events.trigger({
                        node: this.__menu.getItemList().DOM,
                        type: 'item-list-keydown',
                        info: { event: ev }
                    });
                }
                ev.stop();
            }
        });

        this.replace(this.__input);
    }

    enable() {
        super.enable();
        this.__input?.enable();
    }

    disable() {
        super.disable();
        this.__input?.disable();
    }

    displayValue() {
        super.displayValue();
        if (!this.hasData() && CUI.util.isUndef(this.__value)) {
            return;
        }

        this.__loadOptions().done(() => {
            const value = this.getValue();
            const current = this.getOptions().find((opt) => CUI.util.isEqual(opt.value, value));

            let text = '';
            if (current) {
                text = current.text;
            } else if (CUI.util.isNull(value) && this._empty_text) {
                text = this._empty_text;
            } else if (!CUI.util.isNull(value)) {
                text = this._not_found_text + ' ' + value;
            }

            this.__input?.setValue(text);
        });
    }
}
