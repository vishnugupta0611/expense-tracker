import './BudgetProgress.css';

const BudgetProgress = ({ budgetStatus }) => {
  if (!budgetStatus) return null;

  const { daily, monthly, categories } = budgetStatus;

  const getPercentage = (spent, budget) => {
    if (!budget || budget === 0) return 0;
    return Math.min((spent / budget) * 100, 100);
  };

  return (
    <div className="budget-progress">
      <h3>💰 Budget Progress</h3>
      
      {daily && daily.budget > 0 && (
        <div className={`budget-section ${daily.exceeded ? 'exceeded' : ''}`}>
          <div className="budget-header">
            <span className="budget-label">Daily Budget</span>
            <span className={`budget-amount ${daily.exceeded ? 'exceeded' : ''}`}>
              ₹{daily.spent.toFixed(0)} / ₹{daily.budget}
            </span>
          </div>
          <div className="progress-bar">
            <div
              className={`progress-fill ${daily.exceeded ? 'exceeded' : ''}`}
              style={{ width: `${getPercentage(daily.spent, daily.budget)}%` }}
            />
          </div>
        </div>
      )}

      {monthly && monthly.budget > 0 && (
        <div className={`budget-section ${monthly.exceeded ? 'exceeded' : ''}`}>
          <div className="budget-header">
            <span className="budget-label">Monthly Budget</span>
            <span className={`budget-amount ${monthly.exceeded ? 'exceeded' : ''}`}>
              ₹{monthly.spent.toFixed(0)} / ₹{monthly.budget}
            </span>
          </div>
          <div className="progress-bar">
            <div
              className={`progress-fill ${monthly.exceeded ? 'exceeded' : ''}`}
              style={{ width: `${getPercentage(monthly.spent, monthly.budget)}%` }}
            />
          </div>
        </div>
      )}

      {categories && Object.keys(categories).length > 0 && (
        <div className="category-budgets">
          <h4>Category Budgets</h4>
          {Object.entries(categories).map(([category, data]) => {
            if (!data.budget || data.budget === 0) return null;
            const exceeded = data.spent > data.budget;
            return (
              <div key={category} className={`category-budget ${exceeded ? 'exceeded' : ''}`}>
                <div className="budget-header">
                  <span className="budget-label">{category}</span>
                  <span className={`budget-amount ${exceeded ? 'exceeded' : ''}`}>
                    ₹{data.spent.toFixed(0)} / ₹{data.budget}
                  </span>
                </div>
                <div className="progress-bar">
                  <div
                    className={`progress-fill ${exceeded ? 'exceeded' : ''}`}
                    style={{ width: `${getPercentage(data.spent, data.budget)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {(!daily || daily.budget === 0) && (!monthly || monthly.budget === 0) && (!categories || Object.keys(categories).length === 0) && (
        <div className="no-budget">
          <p>No budgets set yet. Set your budgets in Profile to track spending!</p>
        </div>
      )}
    </div>
  );
};

export default BudgetProgress;
