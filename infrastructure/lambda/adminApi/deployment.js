export const Strategy = {
  Linear10PercentEvery10Minutes: {
    increment: 10,
    waitMinutes: 10,
  },
  Linear10PercentEvery1Minute: {
    increment: 10,
    waitMinutes: 1,
  },
  Linear10PercentEvery2Minutes: {
    increment: 10,
    waitMinutes: 2,
  },
  Linear10PercentEvery3Minutes: {
    increment: 10,
    waitMinutes: 3,
  },
  Canary10Percent30Minutes: {
    increment: [10, 90],
    waitMinutes: 30,
  },
  Canary10Percent5Minutes: {
    increment: [10, 90],
    waitMinutes: 5,
  },
  Canary10Percent10Minutes: {
    increment: [10, 90],
    waitMinutes: 10,
  },
  Canary10Percent15Minutes: {
    increment: [10, 90],
    waitMinutes: 15,
  },
  AllAtOnce: {
    increment: 100,
    waitMinutes: 0
  }
};

export const getStates = (mfe, targetVersionNo, strategy) => {
  const currentVersionNo = mfe.activeVersions.find(
    (v) => v.traffic === 100
  ).version;
  let result = [
    {
      activeVersions: mfe.activeVersions,
      default: mfe.default,
    },
  ];
  let remaining = 100;
  let idx = 0;
  do {
    let increment =
      strategy.increment instanceof Array
        ? strategy.increment[idx]
        : strategy.increment;
    remaining -= increment;

    let next = {
      activeVersions: [
        {
          version: targetVersionNo,
          traffic: 100 - remaining,
        },
      ],
    };

    if (remaining > 0) {
      next.activeVersions.push({
        version: currentVersionNo,
        traffic: remaining,
      });
    }

    next.default = remaining > 0 ? currentVersionNo : targetVersionNo;

    result.push(next);
    idx++;
  } while (remaining > 0);

  return result;
};
