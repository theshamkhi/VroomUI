import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ScenarioPlayer } from './scenario-player';

describe('ScenarioPlayer', () => {
  let component: ScenarioPlayer;
  let fixture: ComponentFixture<ScenarioPlayer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ScenarioPlayer],
    }).compileComponents();

    fixture = TestBed.createComponent(ScenarioPlayer);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
