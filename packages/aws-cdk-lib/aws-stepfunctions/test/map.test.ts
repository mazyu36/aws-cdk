import * as cdk from '../../core';
import * as stepfunctions from '../lib';

describe('Map State', () => {
  test('State Machine With Map State', () => {
    // GIVEN
    const stack = new cdk.Stack();

    // WHEN
    const map = new stepfunctions.Map(stack, 'Map State', {
      stateName: 'My-Map-State',
      maxConcurrency: 1,
      itemsPath: stepfunctions.JsonPath.stringAt('$.inputForMap'),
      parameters: {
        foo: 'foo',
        bar: stepfunctions.JsonPath.stringAt('$.bar'),
      },
    });
    map.iterator(new stepfunctions.Pass(stack, 'Pass State'));

    // THEN
    expect(render(map)).toStrictEqual({
      StartAt: 'My-Map-State',
      States: {
        'My-Map-State': {
          Type: 'Map',
          End: true,
          Parameters: {
            'foo': 'foo',
            'bar.$': '$.bar',
          },
          Iterator: {
            StartAt: 'Pass State',
            States: {
              'Pass State': {
                Type: 'Pass',
                End: true,
              },
            },
          },
          ItemsPath: '$.inputForMap',
          MaxConcurrency: 1,
        },
      },
    });
  }),

  test('State Machine With Map State and MaxConcurrencyPath', () => {
    // GIVEN
    const stack = new cdk.Stack();

    // WHEN
    const map = new stepfunctions.Map(stack, 'Map State', {
      stateName: 'My-Map-State',
      maxConcurrencyPath: stepfunctions.JsonPath.stringAt('$.maxConcurrencyPath'),
      itemsPath: stepfunctions.JsonPath.stringAt('$.inputForMap'),
      parameters: {
        foo: 'foo',
        bar: stepfunctions.JsonPath.stringAt('$.bar'),
      },
    });
    map.iterator(new stepfunctions.Pass(stack, 'Pass State'));

    // THEN
    expect(render(map)).toStrictEqual({
      StartAt: 'My-Map-State',
      States: {
        'My-Map-State': {
          Type: 'Map',
          End: true,
          Parameters: {
            'foo': 'foo',
            'bar.$': '$.bar',
          },
          Iterator: {
            StartAt: 'Pass State',
            States: {
              'Pass State': {
                Type: 'Pass',
                End: true,
              },
            },
          },
          ItemsPath: '$.inputForMap',
          MaxConcurrencyPath: '$.maxConcurrencyPath',
        },
      },
    });
  }),

  test('State Machine With Map State and ResultSelector', () => {
    // GIVEN
    const stack = new cdk.Stack();

    // WHEN
    const map = new stepfunctions.Map(stack, 'Map State', {
      maxConcurrency: 1,
      itemsPath: stepfunctions.JsonPath.stringAt('$.inputForMap'),
      resultSelector: {
        buz: 'buz',
        baz: stepfunctions.JsonPath.stringAt('$.baz'),
      },
    });
    map.iterator(new stepfunctions.Pass(stack, 'Pass State'));

    // THEN
    expect(render(map)).toStrictEqual({
      StartAt: 'Map State',
      States: {
        'Map State': {
          Type: 'Map',
          End: true,
          Iterator: {
            StartAt: 'Pass State',
            States: {
              'Pass State': {
                Type: 'Pass',
                End: true,
              },
            },
          },
          ItemsPath: '$.inputForMap',
          MaxConcurrency: 1,
          ResultSelector: {
            'buz': 'buz',
            'baz.$': '$.baz',
          },
        },
      },
    });
  }),

  test('State Machine With Map State and Item Processor', () => {
    // GIVEN
    const stack = new cdk.Stack();

    // WHEN
    const map = new stepfunctions.Map(stack, 'Map State', {
      stateName: 'My-Map-State',
      maxConcurrency: 1,
      itemsPath: stepfunctions.JsonPath.stringAt('$.inputForMap'),
      parameters: {
        foo: 'foo',
        bar: stepfunctions.JsonPath.stringAt('$.bar'),
      },
    });
    map.itemProcessor(new stepfunctions.Pass(stack, 'Pass State'));

    // THEN
    expect(render(map)).toStrictEqual({
      StartAt: 'My-Map-State',
      States: {
        'My-Map-State': {
          Type: 'Map',
          End: true,
          Parameters: {
            'foo': 'foo',
            'bar.$': '$.bar',
          },
          ItemProcessor: {
            ProcessorConfig: {
              Mode: 'INLINE',
            },
            StartAt: 'Pass State',
            States: {
              'Pass State': {
                Type: 'Pass',
                End: true,
              },
            },
          },
          ItemsPath: '$.inputForMap',
          MaxConcurrency: 1,
        },
      },
    });
  }),

  test('State Machine With Map State and Item Selector', () => {
    // GIVEN
    const stack = new cdk.Stack();

    // WHEN
    const map = new stepfunctions.Map(stack, 'Map State', {
      stateName: 'My-Map-State',
      maxConcurrency: 1,
      itemsPath: stepfunctions.JsonPath.stringAt('$.inputForMap'),
      itemSelector: {
        foo: 'foo',
        bar: stepfunctions.JsonPath.stringAt('$.bar'),
      },
    });
    map.itemProcessor(new stepfunctions.Pass(stack, 'Pass State'));

    // THEN
    expect(render(map)).toStrictEqual({
      StartAt: 'My-Map-State',
      States: {
        'My-Map-State': {
          Type: 'Map',
          End: true,
          ItemSelector: {
            'foo': 'foo',
            'bar.$': '$.bar',
          },
          ItemProcessor: {
            ProcessorConfig: {
              Mode: 'INLINE',
            },
            StartAt: 'Pass State',
            States: {
              'Pass State': {
                Type: 'Pass',
                End: true,
              },
            },
          },
          ItemsPath: '$.inputForMap',
          MaxConcurrency: 1,
        },
      },
    });
  }),

  test('State Machine With Map State and Jsonata Item Selector', () => {
    // GIVEN
    const stack = new cdk.Stack();

    // WHEN
    const map = new stepfunctions.Map(stack, 'Map State', {
      stateName: 'My-Map-State',
      maxConcurrency: 1,
      itemsPath: stepfunctions.JsonPath.stringAt('$.inputForMap'),
      jsonataItemSelector: '{% {\"foo\": \"foo\", \"bar\": $states.input.bar} %}',
    });
    map.itemProcessor(new stepfunctions.Pass(stack, 'Pass State'));

    // THEN
    expect(render(map)).toStrictEqual({
      StartAt: 'My-Map-State',
      States: {
        'My-Map-State': {
          Type: 'Map',
          End: true,
          ItemSelector: '{% {\"foo\": \"foo\", \"bar\": $states.input.bar} %}',
          ItemProcessor: {
            ProcessorConfig: {
              Mode: 'INLINE',
            },
            StartAt: 'Pass State',
            States: {
              'Pass State': {
                Type: 'Pass',
                End: true,
              },
            },
          },
          ItemsPath: '$.inputForMap',
          MaxConcurrency: 1,
        },
      },
    });
  }),

  test('State Machine With Map State and Item Processor in distributed mode', () => {
    // GIVEN
    const stack = new cdk.Stack();

    // WHEN
    const map = new stepfunctions.Map(stack, 'Map State', {
      stateName: 'My-Map-State',
      maxConcurrency: 1,
      itemsPath: stepfunctions.JsonPath.stringAt('$.inputForMap'),
      parameters: {
        foo: 'foo',
        bar: stepfunctions.JsonPath.stringAt('$.bar'),
      },
    });
    map.itemProcessor(new stepfunctions.Pass(stack, 'Pass State'), {
      mode: stepfunctions.ProcessorMode.DISTRIBUTED,
      executionType: stepfunctions.ProcessorType.STANDARD,
    });

    // THEN
    expect(render(map)).toStrictEqual({
      StartAt: 'My-Map-State',
      States: {
        'My-Map-State': {
          Type: 'Map',
          End: true,
          Parameters: {
            'foo': 'foo',
            'bar.$': '$.bar',
          },
          ItemProcessor: {
            ProcessorConfig: {
              Mode: 'DISTRIBUTED',
              ExecutionType: 'STANDARD',
            },
            StartAt: 'Pass State',
            States: {
              'Pass State': {
                Type: 'Pass',
                End: true,
              },
            },
          },
          ItemsPath: '$.inputForMap',
          MaxConcurrency: 1,
        },
      },
    });
  }),

  test('State Machine With Map State using JSONata', () => {
    // GIVEN
    const stack = new cdk.Stack();

    // WHEN
    const map = new stepfunctions.Map(stack, 'Map State', {
      stateName: 'My-Map-State',
      maxConcurrency: 1,
      items: stepfunctions.ProvideItems.jsonata('{% $inputForMap %}'),
      itemSelector: {
        foo: 'foo',
        bar: '{% $bar %}',
      },
      queryLanguage: stepfunctions.QueryLanguage.JSONATA,
      assign: {},
    });
    map.itemProcessor(new stepfunctions.Pass(stack, 'Pass State'));

    // THEN
    expect(render(map)).toStrictEqual({
      StartAt: 'My-Map-State',
      States: {
        'My-Map-State': {
          Type: 'Map',
          Assign: {},
          QueryLanguage: 'JSONata',
          End: true,
          ItemSelector: {
            foo: 'foo',
            bar: '{% $bar %}',
          },
          ItemProcessor: {
            ProcessorConfig: {
              Mode: 'INLINE',
            },
            StartAt: 'Pass State',
            States: {
              'Pass State': {
                Type: 'Pass',
                End: true,
              },
            },
          },
          Items: '{% $inputForMap %}',
          MaxConcurrency: 1,
        },
      },
    });
  }),

  test('State Machine With Map State using JSONata static method with Catch method', () => {
    // GIVEN
    const stack = new cdk.Stack();

    // WHEN
    const map = stepfunctions.Map.jsonata(stack, 'Map State', {
      stateName: 'My-Map-State',
      maxConcurrency: 1,
      items: stepfunctions.ProvideItems.jsonata('{% $inputForMap %}'),
      itemSelector: {
        foo: 'foo',
        bar: '{% $bar %}',
      },
      assign: {},
    }).addCatch(
      stepfunctions.Fail.jsonPath(stack, 'failed', {
        error: 'ErrorHappened',
        cause: 'We got stuck',
      }),
      {
        outputs: '$states.errorOutput',
      },
    );
    map.itemProcessor(new stepfunctions.Pass(stack, 'Pass State'));

    // THEN
    expect(render(map)).toStrictEqual({
      StartAt: 'My-Map-State',
      States: {
        'My-Map-State': {
          Type: 'Map',
          Assign: {},
          Catch: [{
            ErrorEquals: ['States.ALL'],
            Next: 'failed',
            Output: '$states.errorOutput',
          }],
          QueryLanguage: 'JSONata',
          End: true,
          ItemSelector: {
            foo: 'foo',
            bar: '{% $bar %}',
          },
          ItemProcessor: {
            ProcessorConfig: {
              Mode: 'INLINE',
            },
            StartAt: 'Pass State',
            States: {
              'Pass State': {
                Type: 'Pass',
                End: true,
              },
            },
          },
          Items: '{% $inputForMap %}',
          MaxConcurrency: 1,
        },
        'failed': {
          Type: 'Fail',
          Error: 'ErrorHappened',
          Cause: 'We got stuck',
        },
      },
    });
  }),

  test('synth is successful with iterator', () => {
    const app = createAppWithMap((stack) => {
      const map = new stepfunctions.Map(stack, 'Map State', {
        maxConcurrency: 1,
        itemsPath: stepfunctions.JsonPath.stringAt('$.inputForMap'),
      });
      map.iterator(new stepfunctions.Pass(stack, 'Pass State'));
      return map;
    });

    app.synth();
  }),

  test('synth is successful with item processor and inline mode', () => {
    const app = createAppWithMap((stack) => {
      const map = new stepfunctions.Map(stack, 'Map State', {
        maxConcurrency: 1,
        itemsPath: stepfunctions.JsonPath.stringAt('$.inputForMap'),
      });
      map.itemProcessor(new stepfunctions.Pass(stack, 'Pass State'));
      return map;
    });

    app.synth();
  }),

  test('synth is successful with item selector', () => {
    const app = createAppWithMap((stack) => {
      const map = new stepfunctions.Map(stack, 'Map State', {
        maxConcurrency: 1,
        itemsPath: stepfunctions.JsonPath.stringAt('$.inputForMap'),
        itemSelector: {
          foo: 'foo',
          bar: stepfunctions.JsonPath.stringAt('$.bar'),
        },
      });
      map.itemProcessor(new stepfunctions.Pass(stack, 'Pass State'));
      return map;
    });

    app.synth();
  }),

  test('synth is successful with item processor and distributed mode', () => {
    const app = createAppWithMap((stack) => {
      const map = new stepfunctions.Map(stack, 'Map State', {
        maxConcurrency: 1,
        itemsPath: stepfunctions.JsonPath.stringAt('$.inputForMap'),
      });
      map.itemProcessor(new stepfunctions.Pass(stack, 'Pass State'), {
        mode: stepfunctions.ProcessorMode.DISTRIBUTED,
        executionType: stepfunctions.ProcessorType.STANDARD,
      });
      return map;
    });

    app.synth();
  }),

  test('fails in synthesis if iterator and item processor are missing', () => {
    const app = createAppWithMap((stack) => {
      const map = new stepfunctions.Map(stack, 'Map State', {
        maxConcurrency: 1,
        itemsPath: stepfunctions.JsonPath.stringAt('$.inputForMap'),
      });

      return map;
    });

    expect(() => app.synth()).toThrow(/Map state must either have a non-empty iterator or a non-empty item processor/);
  }),

  test('fails in synthesis if both iterator and item processor are defined', () => {
    const app = createAppWithMap((stack) => {
      const map = new stepfunctions.Map(stack, 'Map State', {
        maxConcurrency: 1,
        itemsPath: stepfunctions.JsonPath.stringAt('$.inputForMap'),
      });
      map.iterator(new stepfunctions.Pass(stack, 'Pass State 1'));
      map.itemProcessor(new stepfunctions.Pass(stack, 'Pass State 2'));

      return map;
    });

    expect(() => app.synth()).toThrow(/Map state cannot have both an iterator and an item processor/);
  }),

  test('fails in synthesis if parameters and item selector are defined', () => {
    const app = createAppWithMap((stack) => {
      const map = new stepfunctions.Map(stack, 'Map State', {
        maxConcurrency: 1,
        itemsPath: stepfunctions.JsonPath.stringAt('$.inputForMap'),
        parameters: {
          foo: 'foo',
          bar: stepfunctions.JsonPath.stringAt('$.bar'),
        },
        itemSelector: {
          foo: 'foo',
          bar: stepfunctions.JsonPath.stringAt('$.bar'),
        },
      });

      return map;
    });

    expect(() => app.synth()).toThrow(/Map state cannot have both parameters and an item selector/);
  }),

  test('fails in synthesis if parameters and jsonata item selector are defined', () => {
    const app = createAppWithMap((stack) => {
      const map = new stepfunctions.Map(stack, 'Map State', {
        maxConcurrency: 1,
        itemsPath: stepfunctions.JsonPath.stringAt('$.inputForMap'),
        parameters: {
          foo: 'foo',
          bar: stepfunctions.JsonPath.stringAt('$.bar'),
        },
        jsonataItemSelector: '{% { \"foo\": \"foo\", \"bar\": $states.input.bar } %}',
      });

      return map;
    });

    expect(() => app.synth()).toThrow(/Map state cannot have both parameters and an item selector/);
  }),

  test('fails in synthesis if jsonata item selector is not a JSONata expression', () => {
    const app = createAppWithMap((stack) => {
      const map = new stepfunctions.Map(stack, 'Map State', {
        maxConcurrency: 1,
        itemsPath: stepfunctions.JsonPath.stringAt('$.inputForMap'),
        jsonataItemSelector: 'Invalid expression',
      });

      return map;
    });

    expect(() => app.synth()).toThrow(/The `jsonataItemSelector` property must be a valid JSONata expression/);
  }),

  test('fails in synthesis if distributed mode and execution type is not defined', () => {
    const app = createAppWithMap((stack) => {
      const map = new stepfunctions.Map(stack, 'Map State', {
        maxConcurrency: 1,
        itemsPath: stepfunctions.JsonPath.stringAt('$.inputForMap'),
      });
      map.itemProcessor(new stepfunctions.Pass(stack, 'Pass State'), {
        mode: stepfunctions.ProcessorMode.DISTRIBUTED,
      });

      return map;
    });

    expect(() => app.synth()).toThrow(/You must specify an execution type for the distributed Map workflow/);
  }),

  test('fails in synthesis when maxConcurrency is a float', () => {
    const app = createAppWithMap((stack) => {
      const map = new stepfunctions.Map(stack, 'Map State', {
        maxConcurrency: 1.2,
        itemsPath: stepfunctions.JsonPath.stringAt('$.inputForMap'),
      });
      map.iterator(new stepfunctions.Pass(stack, 'Pass State'));

      return map;
    });

    expect(() => app.synth()).toThrow(/maxConcurrency has to be a positive integer/);
  }),

  test('fails in synthesis when maxConcurrency is a negative integer', () => {
    const app = createAppWithMap((stack) => {
      const map = new stepfunctions.Map(stack, 'Map State', {
        maxConcurrency: -1,
        itemsPath: stepfunctions.JsonPath.stringAt('$.inputForMap'),
      });
      map.iterator(new stepfunctions.Pass(stack, 'Pass State'));

      return map;
    });

    expect(() => app.synth()).toThrow(/maxConcurrency has to be a positive integer/);
  }),

  test('fails in synthesis when maxConcurrency is too big to be an integer', () => {
    const app = createAppWithMap((stack) => {
      const map = new stepfunctions.Map(stack, 'Map State', {
        maxConcurrency: Number.MAX_VALUE,
        itemsPath: stepfunctions.JsonPath.stringAt('$.inputForMap'),
      });
      map.iterator(new stepfunctions.Pass(stack, 'Pass State'));

      return map;
    });

    expect(() => app.synth()).toThrow(/maxConcurrency has to be a positive integer/);
  }),

  test('fails in synthesis when maxConcurrency and maxConcurrencyPath are both defined', () => {
    const app = createAppWithMap((stack) => {
      const map = new stepfunctions.Map(stack, 'Map State', {
        maxConcurrency: 1,
        maxConcurrencyPath: stepfunctions.JsonPath.stringAt('$.maxConcurrencyPath'),
        itemsPath: stepfunctions.JsonPath.stringAt('$.inputForMap'),
      });
      map.iterator(new stepfunctions.Pass(stack, 'Pass State'));

      return map;
    });

    expect(() => app.synth()).toThrow(/Provide either `maxConcurrency` or `maxConcurrencyPath`, but not both/);
  }),

  test('does not fail synthesis when maxConcurrency is a jsonPath', () => {
    const app = createAppWithMap((stack) => {
      const map = new stepfunctions.Map(stack, 'Map State', {
        maxConcurrency: stepfunctions.JsonPath.numberAt('$.maxConcurrency'),
        itemsPath: stepfunctions.JsonPath.stringAt('$.inputForMap'),
      });
      map.iterator(new stepfunctions.Pass(stack, 'Pass State'));

      return map;
    });

    expect(() => app.synth()).not.toThrow();
  });

  test('isPositiveInteger is false with negative number', () => {
    expect(stepfunctions.isPositiveInteger(-1)).toEqual(false);
  }),

  test('isPositiveInteger is false with decimal number', () => {
    expect(stepfunctions.isPositiveInteger(1.2)).toEqual(false);
  }),

  test('isPositiveInteger is false with a value greater than safe integer', () => {
    const valueToTest = Number.MAX_SAFE_INTEGER + 1;
    expect(stepfunctions.isPositiveInteger(valueToTest)).toEqual(false);
  }),

  test('isPositiveInteger is true with 0', () => {
    expect(stepfunctions.isPositiveInteger(0)).toEqual(true);
  }),

  test('isPositiveInteger is true with 10', () => {
    expect(stepfunctions.isPositiveInteger(10)).toEqual(true);
  }),

  test('isPositiveInteger is true with max integer value', () => {
    expect(stepfunctions.isPositiveInteger(Number.MAX_SAFE_INTEGER)).toEqual(true);
  }),

  test('items from JSON array', () => {
    // GIVEN
    const jsonArray = [1, '{% $two %}', 3];

    // WHEN
    const items = stepfunctions.ProvideItems.jsonArray(jsonArray);

    // THEN
    expect(items).toEqual({
      items: [1, '{% $two %}', 3],
    });
  }),

  test('items from JSONata expression', () => {
    // GIVEN
    const jsonataExpression = '{% $items %}';

    // WHEN
    const items = stepfunctions.ProvideItems.jsonata(jsonataExpression);

    // THEN
    expect(items).toEqual({
      items: '{% $items %}',
    });
  });
});

function render(sm: stepfunctions.IChainable) {
  return new cdk.Stack().resolve(new stepfunctions.StateGraph(sm.startState, 'Test Graph').toGraphJson());
}

function createAppWithMap(mapFactory: (stack: cdk.Stack) => stepfunctions.Map) {
  const app = new cdk.App();
  const stack = new cdk.Stack(app, 'my-stack');
  const map = mapFactory(stack);
  new stepfunctions.StateGraph(map, 'Test Graph');
  return app;
}
