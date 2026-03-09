import { Pipe, PipeTransform } from '@angular/core';
import { Progress } from '../models/progress.model';

@Pipe({
  name: 'progressForScenario',
  standalone: true
})
export class ProgressForScenarioPipe implements PipeTransform {
  transform(progressList: Progress[], scenarioId: string): Progress | undefined {
    return progressList.find(p => p.scenarioId === scenarioId);
  }
}
