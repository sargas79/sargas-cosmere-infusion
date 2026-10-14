/**
 * Small ApplicationV2 base that renders an HTML string and dispatches `data-sci-action` clicks and
 * form changes to subclass methods. Keeps the apps free of template-path plumbing.
 */
import { MODULE_ID } from '@/constants';

/* eslint-disable @typescript-eslint/no-explicit-any */

const ApplicationV2: any = foundry.applications.api.ApplicationV2;

export abstract class HtmlApp extends ApplicationV2 {
    static DEFAULT_OPTIONS: Record<string, unknown> = {
        classes: [MODULE_ID, 'sci-app'],
        window: { resizable: true },
        position: { width: 520, height: 'auto' },
    };

    declare element: HTMLElement;
    declare render: (options?: any) => Promise<this>;

    protected abstract renderBody(): string | Promise<string>;

    async close(options?: any): Promise<this> {
        return super.close(options);
    }

    /** Click on an element with `data-sci-action`. */
    protected onAction(_action: string, _target: HTMLElement, _event: Event): void | Promise<void> {}

    /** `change` event on any input inside the app. */
    protected onInputChange(_target: HTMLElement, _event: Event): void | Promise<void> {}

    async _renderHTML(): Promise<string> {
        return this.renderBody();
    }

    _replaceHTML(result: string, content: HTMLElement) {
        content.innerHTML = result;
    }

    _onFirstRender(context: any, options: any) {
        super._onFirstRender?.(context, options);
        this.element.addEventListener('click', (event: Event) => {
            const target = (event.target as HTMLElement).closest<HTMLElement>('[data-sci-action]');
            if (!target || !this.element.contains(target)) return;
            event.preventDefault();
            void this.onAction(target.dataset.sciAction!, target, event);
        });
        this.element.addEventListener('change', (event: Event) => {
            void this.onInputChange(event.target as HTMLElement, event);
        });
        this.element.addEventListener('submit', (event: Event) => event.preventDefault());
    }

    /** Reads every named input in the app into a flat object (checkboxes as booleans). */
    protected readForm(): Record<string, string | boolean> {
        const data: Record<string, string | boolean> = {};
        for (const el of this.element.querySelectorAll<HTMLInputElement>('[name]')) {
            data[el.name] = el.type === 'checkbox' ? el.checked : el.value;
        }
        return data;
    }
}
