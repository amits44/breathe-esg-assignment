# ingestion/migrations/0002_add_scope_fields.py
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('ingestion', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='normalizedrecord',
            name='emission_scope',
            field=models.IntegerField(
                null=True,
                blank=True,
                choices=[(1, 'Scope 1 — Direct'), (2, 'Scope 2 — Purchased Energy'), (3, 'Scope 3 — Value Chain')],
                help_text='GHG Protocol scope: 1=direct, 2=purchased energy, 3=value chain'
            ),
        ),
        migrations.AddField(
            model_name='normalizedrecord',
            name='co2e_kg',
            field=models.DecimalField(
                max_digits=12,
                decimal_places=4,
                default=0,
                help_text='Estimated CO2 equivalent in kg'
            ),
        ),
    ]