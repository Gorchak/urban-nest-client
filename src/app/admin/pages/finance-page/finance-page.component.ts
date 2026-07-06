import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TabViewModule } from 'primeng/tabview';
import { ExpenseAccountingComponent } from './expense-accounting/expense-accounting.component';
import { IncomeExpensesComponent } from './income-expenses/income-expenses.component';

@Component({
  selector: 'app-finance-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TabViewModule, IncomeExpensesComponent, ExpenseAccountingComponent],
  templateUrl: './finance-page.component.html',
  styleUrls: ['./finance-page.component.scss'],
})
export class FinancePageComponent {}
