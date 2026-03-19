### Skill: Django Guidelines
- **ORM Queries**: Always use `select_related()` for ForeignKey and `prefetch_related()` for ManyToMany to eliminate N+1. Never lazy-load in loops.
- **Fat Models, Thin Views**: Keep business logic in models or service modules. Views should only handle request/response — no domain logic.
- **Class-Based Views**: Use CBVs for standard CRUD. Use `LoginRequiredMixin` and `PermissionRequiredMixin` for access control — never duplicate auth logic per method.
- **Forms & Serializers**: Always validate input through `ModelForm` or DRF `Serializer`. Never access `request.POST` or `request.data` directly in views without validation.
- **Signals**: Use signals sparingly. Never trigger business logic that must be transactional from a signal — use explicit service calls instead.
- **Migrations**: Run `makemigrations --check` in CI to catch unapplied model changes. Never edit migration files manually after they are applied in any environment.
- **Settings**: Split settings into `base.py`, `development.py`, `production.py`. Use `django-environ` for environment variables. Never commit production secrets.
- **QuerySet Reuse**: Define reusable filtering logic as custom `QuerySet` methods on a Manager. Do not repeat `filter()` chains across views and serializers.
